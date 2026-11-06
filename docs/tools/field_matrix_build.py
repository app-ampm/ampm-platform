#!/usr/bin/env python3
"""Build docs/field-matrix.md and docs/field-matrix.csv.

Inputs:  docs/data-model.md  (the Mermaid entity blocks are the field inventory)
         docs/tools/field_rules.py  (editors, requiredness, validation, automation per table and field)
Run:     python3 docs/tools/field_matrix_build.py
The generated files must not be edited by hand; change the data model or the rules and rebuild.
"""
from __future__ import annotations

import csv
import re
import sys
from collections import Counter, OrderedDict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent
sys.path.insert(0, str(HERE))
import field_rules as R  # noqa: E402

MODEL = DOCS / "data-model.md"
OUT_MD = DOCS / "field-matrix.md"
OUT_CSV = DOCS / "field-matrix.csv"

ATTR = re.compile(r'^\s{8}(\w+) (\w+)(?: (PK|FK|UK))?(?: "([^"]*)")?\s*$')
ENTITY = re.compile(r"^\s{4}([a-z_]+) \{\n(.*?)^\s{4}\}", re.S | re.M)
MODULE_H = re.compile(r"^## \d+[a-z]?\. Module ([A-Q]) — (.+)$")
MARKERS = ("RESTRICTED", "SENSITIVE", "CLIENT", "PUBLIC")
SECRET_NAMES = {"password_hash", "mfa_secret_ref", "token_hash", "storage_key", "thumbnail_key", "web_key"}
FINANCE_HINTS = ("cost", "amount", "fee", "margin", "rate_")
CONTACT_HINTS = ("phone", "email", "contact", "driver")
ACTOR_SUFFIXES = ("_by", "_by_user_id")
ACTOR_NAMES = {"actor_user_id", "uploaded_by", "recorded_by", "requested_by_user_id", "author_user_id",
               "captured_by_user_id", "saved_by_user_id", "submitted_by_user_id", "decided_by_user_id",
               "accepted_by_user_id", "activated_by_user_id", "verified_by", "collected_by"}
USER_ENTERED_AT = {"due_at", "scheduled_at", "actual_at", "slot_start", "slot_end", "shift_start", "shift_end",
                   "planned_start", "planned_end", "actual_start", "actual_end", "found_at", "returned_at",
                   "checked_out_at", "signed_at", "onboarded_at", "starts_at", "ends_at", "trial_ends_at",
                   "expires_at", "next_due_at", "occurred_at", "incurred_at", "received_at", "verified_at",
                   "actual_departure_at", "actual_arrival_at", "retention_until", "client_access_until"}

FK_TARGETS = {
    "account_id": "client_accounts", "converted_account_id": "client_accounts",
    "project_id": "wedding_projects", "consent_source_project_id": "wedding_projects", "source_project_id": "wedding_projects",
    "enquiry_id": "hotel_enquiries", "hotel_enquiry_id": "hotel_enquiries",
    "hotel_id": "hotels", "primary_hotel_id": "hotels", "destination_id": "destinations",
    "function_id": "functions", "function_type_id": "function_types",
    "vendor_id": "vendors", "vendor_assignment_id": "vendor_assignments", "caterer_assignment_id": "vendor_assignments",
    "room_category_id": "hotel_room_categories", "venue_id": "hotel_venues", "hotel_venue_id": "hotel_venues",
    "external_venue_id": "external_venues", "approval_id": "approvals", "superseded_by_approval_id": "approvals",
    "contract_id": "contracts", "invoice_id": "invoices", "payment_id": "payments", "refund_of_payment_id": "payments",
    "plan_id": "plans", "source_id": "lead_sources", "lead_id": "leads", "service_type_id": "service_types",
    "service_agreement_id": "service_agreements", "primary_service_agreement_id": "service_agreements",
    "payment_milestone_id": "payment_milestones", "verification_id": "hotel_verifications", "rate_card_id": "hotel_rate_cards",
    "family_group_id": "family_groups", "guest_id": "guests", "claimed_by_guest_id": "guests", "primary_guest_id": "guests",
    "token_id": "rsvp_tokens", "rsvp_token_id": "rsvp_tokens", "room_block_id": "room_blocks",
    "room_allocation_id": "room_allocations", "transfer_id": "transfers", "vehicle_id": "vehicles",
    "travel_segment_id": "travel_segments", "menu_id": "menus", "menu_version_id": "menu_versions",
    "design_item_id": "design_items", "invitation_id": "invitations", "invitation_version_id": "invitation_versions",
    "budget_line_id": "budget_lines", "template_id": "checklist_templates", "checklist_id": "checklists",
    "checklist_item_id": "checklist_items", "task_id": "tasks", "depends_on_task_id": "tasks",
    "parent_comment_id": "comments", "previous_version_id": "documents", "invited_by_contact_id": "account_contacts",
    "role_id": "roles", "permission_id": "permissions", "media_asset_id": "media_assets",
    "proposal_id": "hotel_proposals", "supersedes_proposal_id": "(same table)", "parent_id": "(same table)",
    "category_id": "(budget_categories or vendor_categories by module)", "primary_category_id": "vendor_categories",
}


def parse_model(text: str):
    modules: "OrderedDict[str, str]" = OrderedDict()
    tables: "OrderedDict[str, dict]" = OrderedDict()
    current = None
    in_fence, buf = False, []
    for line in text.split("\n"):
        m = MODULE_H.match(line)
        if m:
            current = m.group(1)
            modules[current] = m.group(2).strip()
            continue
        if line.startswith("```mermaid"):
            in_fence, buf = True, []
            continue
        if in_fence and line.startswith("```"):
            in_fence = False
            fence = "\n".join(buf) + "\n"
            for em in ENTITY.finditer(fence):
                t, body = em.group(1), em.group(2)
                fields = []
                for fl in body.strip("\n").split("\n"):
                    am = ATTR.match(fl)
                    if not am:
                        raise SystemExit(f"unparsed attribute in {t}: {fl!r}")
                    typ, name, key, comment = am.groups()
                    fields.append(dict(name=name, type=typ, key=key or "", comment=comment or ""))
                if t in tables:
                    raise SystemExit(f"duplicate entity {t}")
                tables[t] = dict(module=current, fields=fields)
            continue
        if in_fence:
            buf.append(line)
    return modules, tables


def split_comment(comment: str):
    c = comment.strip()
    markers = {m for m in MARKERS if re.search(r"\b" + m + r"\b", c)}
    options, note = "", c
    em = re.match(r"^enum\s+(.*)$", c)
    if em:
        body = em.group(1)
        mm = re.match(r"^([\w\s/]+?)(?:\s*[,(].*)?$", body)
        if mm:
            options = ", ".join(p.strip() for p in mm.group(1).split("/"))
            note = body[len(mm.group(1)):].strip(" ,")
        else:
            options, note = body, ""
    else:
        for m in MARKERS:
            note = re.sub(r"\b" + m + r"\b[,:]?\s*", "", note)
        note = note.strip(" ,")
        if note.startswith("table"):
            note = "whole " + note
    return markers, options, note


def classify(f, trule):
    name, comment = f["name"], f["comment"]
    fr = trule["fields"].get(name, {})
    if "visibility" in fr:
        return fr["visibility"]
    if name in SECRET_NAMES:
        return "SECRET"
    if "SENSITIVE" in comment:
        return "SENSITIVE-GUEST"
    if trule.get("table_class"):
        return trule["table_class"]
    if "RESTRICTED" in comment:
        if "bank" in name:
            return "RESTRICTED-BANK"
        if any(k in name for k in FINANCE_HINTS):
            return "RESTRICTED-FINANCE"
        if any(k in name for k in CONTACT_HINTS):
            return "RESTRICTED-CONTACT"
        return "RESTRICTED-NOTES"
    if "CLIENT" in comment:
        return "CLIENT"
    if "PUBLIC" in comment:
        return "PUBLIC"
    return trule["default_class"]


def is_actor(name, key):
    return key == "FK" and (name in ACTOR_NAMES or any(name.endswith(s) for s in ACTOR_SUFFIXES))


def editor(f, trule):
    name, key = f["name"], f["key"]
    fr = trule["fields"].get(name, {})
    if "editor" in fr:
        return fr["editor"]
    if name == "id" or name in SECRET_NAMES:
        return "SYS"
    if is_actor(name, key):
        return "SYS (acting user)"
    if name.endswith("_at") and name not in USER_ENTERED_AT:
        return "SYS (when the action happens)"
    return trule["editor"]


def required(f, trule):
    name, key = f["name"], f["key"]
    fr = trule["fields"].get(name, {})
    if "required" in fr:
        return fr["required"]
    if name == "id":
        return "System"
    if name in trule["required"]:
        return trule["required_label"]
    if is_actor(name, key):
        return "System"
    if name.endswith("_at") and name not in USER_ENTERED_AT:
        return "System"
    if name == "status":
        return "System default at creation"
    return "Optional"


def fk_target(table, name):
    if name in FK_TARGETS:
        t = FK_TARGETS[name]
        if t.startswith("(budget"):
            return "budget_categories" if table.startswith("budget") else "vendor_categories"
        if t == "(same table)":
            return table
        return t
    if name.endswith("_user_id") or name.endswith("_by"):
        return "users"
    if name.endswith("_document_id"):
        return "documents"
    if name.endswith("_media_id"):
        return "media_assets"
    return "see data model"


TYPE_LABEL = {"uuid": "UUID", "string": "string, up to 255 characters", "text": "text, up to 10,000 characters",
              "int": "integer", "decimal": "numeric(14,2)", "bool": "boolean", "json": "JSON", "date": "date",
              "datetime": "timestamp (UTC)", "time": "time of day in the project time zone"}
PAIRS = {"date_to": "date_from", "valid_to": "valid_from", "end_date": "start_date", "end_time": "start_time",
         "check_out_date": "check_in_date", "planned_end": "planned_start", "slot_end": "slot_start",
         "shift_end": "shift_start", "tentative_date_to": "tentative_date_from"}
MONEY = ("amount", "cost", "fee", "total", "margin", "billed", "paid")
PHONE = ("phone", "whatsapp_number", "driver_phone", "contact_phone")


def validation(table, f, trule, options, note):
    name, typ, key = f["name"], f["type"], f["key"]
    fr = trule["fields"].get(name, {})
    if "validation" in fr:
        parts = [fr["validation"]]
        note = ""  # the hand-written rule is authoritative; the diagram comment is not repeated
    else:
        parts = []
        if name == "id" and key == "PK":
            parts.append("UUID v7, generated")
        elif key == "FK":
            parts.append(f"references {fk_target(table, name)}")
        elif options:
            parts.append("one of the listed options")
        elif name == "email" or name.endswith("_email"):
            parts.append("valid email address, stored lowercase")
        elif name in PHONE:
            parts.append("E.164 format, default +91")
        elif name == "currency":
            parts.append("ISO 4217 code, default INR (A-16)")
        elif name == "slug":
            parts.append("lowercase letters, digits and hyphens; unique")
        elif name.endswith("_key") and key == "UK":
            parts.append("lowercase snake_case; unique")
        elif name in PAIRS:
            parts.append(f"{TYPE_LABEL.get(typ, typ)}; not before {PAIRS[name]}")
        elif typ == "decimal" and any(h in name for h in MONEY):
            parts.append("numeric(14,2), 0 or more")
        elif name == "version_number":
            parts.append("integer, 1 or more; increments by 1 within its parent; immutable once shared")
        elif name in ("sort_order", "sequence"):
            parts.append("integer, 0 or more; unique within its parent")
        elif typ == "int":
            parts.append("integer, 0 or more")
        elif typ == "json":
            parts.append("valid JSON matching the registered schema")
        elif typ == "bool":
            parts.append("true or false")
        else:
            parts.append(TYPE_LABEL.get(typ, typ))
    if fr.get("validation_extra"):
        parts.append(fr["validation_extra"])
    if note:
        parts.append(note)
    return "; ".join(p for p in parts if p)


AUTO_DEFAULT = {
    "status": "Transitions per permission-matrix §7; each transition audited; notifications per §8",
    "client_visible": "Sharing change audited; switches the client serialiser",
    "visibility": "Sharing change audited; switches the serialiser per class",
    "internal_only": "Hidden from client serialisers; audited",
    "is_internal": "Hidden from client serialisers; fixed at creation",
    "rights_status": "Client, demo or public visibility refused unless owned, licensed or consent_obtained",
    "due_at": "Overdue items appear on dashboards (SPEC §8)",
    "due_date": "Overdue items appear on dashboards (SPEC §8)",
    "verified_at": "Stale job compares with the configured age and sets the freshness label",
    "next_due_at": "Set to verified_at plus the configured age",
    "version_number": "A new version supersedes earlier approvals (SPEC §12)",
    "retention_until": "Retention job deletes after this date (A-17)",
    "expires_at": "Refused after expiry",
    "internal_notes": "Never serialised to client, guest or demo principals",
}


def automation(f, trule):
    name = f["name"]
    fr = trule["fields"].get(name, {})
    if "automation" in fr:
        return fr["automation"]
    return AUTO_DEFAULT.get(name, "—")

CLASSES = ["RESTRICTED-IDENTITY", "RESTRICTED-FINANCE", "RESTRICTED-CONTACT", "RESTRICTED-BANK", "RESTRICTED-NOTES",
           "SENSITIVE-GUEST", "SECRET", "PUBLIC", "CLIENT", "INTERNAL"]


def canonical_class(v: str) -> str:
    for c in CLASSES:
        if v.startswith(c):
            return c
    return "Other (per record, recipient or parent)"


def build():
    modules, tables = parse_model(MODEL.read_text(encoding="utf8"))
    missing = [t for t in tables if t not in R.TABLES]
    extra = [t for t in R.TABLES if t not in tables]
    if missing or extra:
        raise SystemExit(f"rules missing for {missing}; rules for unknown tables {extra}")
    typos = []
    for t, rule in R.TABLES.items():
        names = {f["name"] for f in tables[t]["fields"]}
        typos += [f"{t}.{n}" for n in rule["fields"] if n not in names]
        typos += [f"{t}.{n} (required)" for n in rule["required"] if n not in names]
    if typos:
        raise SystemExit(f"rules refer to unknown fields: {typos}")

    rows = []
    for t, info in tables.items():
        rule = R.TABLES[t]
        for f in info["fields"]:
            markers, options, note = split_comment(f["comment"])
            rows.append(dict(
                module=info["module"], table=t, stage=rule["stage"], field=f["name"], type=f["type"], key=f["key"],
                options=options, validation=validation(t, f, rule, options, note), editor=editor(f, rule),
                visibility=classify(f, rule), required=required(f, rule), automation=automation(f, rule),
                assumptions=rule["assumptions"]))

    # ---- CSV
    with OUT_CSV.open("w", newline="", encoding="utf8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # ---- Markdown
    by_module = Counter(r["module"] for r in rows)
    tables_by_module = Counter(info["module"] for info in tables.values())
    req = Counter(r["module"] for r in rows if r["required"].startswith("At creation"))
    client = Counter(r["module"] for r in rows if canonical_class(r["visibility"]) in ("CLIENT", "PUBLIC"))
    restricted = Counter(r["module"] for r in rows if canonical_class(r["visibility"]).startswith(("RESTRICTED", "SENSITIVE", "SECRET")))
    vis_total = Counter(canonical_class(r["visibility"]) for r in rows)

    out = []
    out.append("# AMPM Platform — Field Matrix\n")
    out.append(f"**Status:** DRAFT v0.1, generated {date.today().isoformat()} from [data-model.md](data-model.md) "
               "by `docs/tools/field_matrix_build.py`. Do not edit by hand; change the data model or "
               "`docs/tools/field_rules.py` and rebuild.")
    out.append("**Companions:** [requirements-audit.md](requirements-audit.md) (Q numbers), "
               "[data-model.md](data-model.md) (assumptions A-1 to A-30), "
               "[permission-matrix.md](permission-matrix.md) (role codes, visibility classes, assumptions P-1 to P-11).")
    out.append("**Spreadsheet version:** [field-matrix.csv](field-matrix.csv) has the same rows for filtering.\n")
    out.append("Implements the pattern in SPEC §5: for every field, its type and validation, options, who edits it, "
               "its visibility, when it becomes required, and its automation and report impact. "
               "Every field of every table in the data model appears here; standard columns "
               "(`created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`) are omitted because data-model.md §1 "
               "defines them once for all tables.\n")
    out.append("## 0. How to read\n")
    out.append("- **Edited by** uses the role codes of permission-matrix.md §2: SA, SM, HT, PM, CD, VC, RG, HL, FA for staff; "
               "CO, CA, CV for client users; GU for a guest token; DP for a demo prospect; SYS for the system. "
               "**(a)** means on assigned weddings only. \"SYS (acting user)\" means the field records whoever performed the action and is never typed in.")
    out.append("- **Visibility** is the field's class from permission-matrix.md §4: PUBLIC, CLIENT, INTERNAL, RESTRICTED-NOTES, "
               "RESTRICTED-FINANCE, RESTRICTED-CONTACT, RESTRICTED-BANK, SENSITIVE-GUEST, RESTRICTED-IDENTITY, SECRET. "
               "A qualifier such as \"CLIENT when shared\" means the class applies only once the owning record is shared; before that the field is INTERNAL.")
    out.append("- **Required** says when a value must exist: *At creation* (the record cannot be saved without it), "
               "*Before <state>* (the transition is refused without it), *System* (set by the platform), or *Optional*. "
               "This is how BIZ rule 2 and SPEC §5 (\"avoid making all fields mandatory at project creation\") are honoured: "
               "requiredness attaches to the stage that needs the value.")
    out.append("- **Automation and report impact** names the job, notification, recalculation or report that the field drives. "
               "\"—\" means the field is stored and displayed only.")
    out.append("- **Assumptions** on each table header tie the choices to the audit questions (Q) through the assumption registers (A, P).\n")
    out.append("Global conventions that apply to every row: money is `numeric(14,2)` with a sibling currency defaulting to INR (A-16, Q16); "
               "timestamps are UTC and displayed in the project time zone (A-16); soft delete only, with physical deletion by retention jobs (A-17, Q17); "
               "restricted and secret fields are never serialised to a principal outside their class (SPEC §4 security note).\n")
    out.append("## 1. Summary\n")
    out.append("| Module | Tables | Fields | Required at creation | Client or public visible | Restricted, sensitive or secret |")
    out.append("|---|---|---|---|---|---|")
    for m, title in modules.items():
        out.append(f"| {m} — {title} | {tables_by_module[m]} | {by_module[m]} | {req[m]} | {client[m]} | {restricted[m]} |")
    out.append(f"| **Total** | **{len(tables)}** | **{len(rows)}** | **{sum(req.values())}** | **{sum(client.values())}** | **{sum(restricted.values())}** |\n")
    out.append("Fields by visibility class: " + ", ".join(f"{k} {v}" for k, v in sorted(vis_total.items(), key=lambda kv: -kv[1])) + ".\n")

    sec = 2
    for m, title in modules.items():
        out.append(f"---\n\n## {sec}. Module {m} — {title}\n")
        sec += 1
        for t, info in tables.items():
            if info["module"] != m:
                continue
            rule = R.TABLES[t]
            out.append(f"### `{t}`\n")
            hdr = f"Created at stage: **{rule['stage']}** · Default editor: {rule['editor']} · Default visibility: {rule['default_class']}"
            if rule["table_class"]:
                hdr += f" · Whole table: **{rule['table_class']}**"
            if rule["assumptions"]:
                hdr += f" · Assumptions: {rule['assumptions']}"
            if rule["note"]:
                hdr += f" · {rule['note']}"
            out.append(hdr + "\n")
            out.append("| Field | Type and validation | Options | Edited by | Visibility | Required | Automation and report impact |")
            out.append("|---|---|---|---|---|---|---|")
            for r in rows:
                if r["table"] != t:
                    continue
                keyflag = {"PK": " (PK)", "FK": " (FK)", "UK": " (unique)"}.get(r["key"], "")
                out.append(f"| `{r['field']}`{keyflag} | {r['validation']} | {r['options']} | {r['editor']} | "
                           f"{r['visibility']} | {r['required']} | {r['automation']} |")
            out.append("")
    OUT_MD.write_text("\n".join(out) + "\n", encoding="utf8")
    print(f"tables {len(tables)}, fields {len(rows)}; wrote {OUT_MD.name} and {OUT_CSV.name}")
    print("visibility:", dict(vis_total))


if __name__ == "__main__":
    build()
