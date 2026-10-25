#!/usr/bin/env python3
"""Build the Obsidian notes for the AMPM vault (vault/ inside the project, its own git repository).

Writes, under notes/: one note per audit question (Decisions/), per assumption (Assumptions/), per audit finding
(Findings/), per open item (Open items/, created once and never overwritten so answers can be recorded there),
plus index notes and Home.md at the vault root. Sources: docs/decisions.json, docs/requirements-audit.md, the six
assumption registers, docs/data-model.md §20.2 (resolutions).
Run: python3 docs/tools/vault_build.py
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

import os

PROJECT = Path(__file__).resolve().parent.parent.parent
DOCS = PROJECT / "docs"
ROOT = Path(os.environ.get("AMPM_VAULT", PROJECT / "vault"))  # the Obsidian vault
NOTES = ROOT / "notes"
DEC = json.loads((DOCS / "decisions.json").read_text(encoding="utf8"))
AUDIT = (DOCS / "requirements-audit.md").read_text(encoding="utf8")
REGISTERS = [("data-model.md", "A", "Data model"), ("permission-matrix.md", "P", "Permission matrix"), ("architecture.md", "T", "Architecture"),
             ("user-flows.md", "U", "User flows"), ("wireframes.md", "W", "Wireframes"), ("test-cases.md", "V", "Test cases")]
ROW = re.compile(r"^\| ([APTUWV]-\d+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$", re.M)
MARK = re.compile(r"\s*\*\*AMPM \(\d{4}-\d{2}-\d{2}\): [^*]*\*\*\s*$")
LABEL = {"confirmed": "Confirmed", "changed": "Changed", "partly": "Partly decided", "dropped": "Dropped", "open": "Still open", "stands": "Not addressed, stands"}
QLABEL = {"decided": "Decided", "partly": "Partly decided", "open": "Still open"}
TIER_NAME = {1: "Tier 1, blocking design sign-off", 2: "Tier 2, before the build starts", 3: "Tier 3, before the later phases"}
DOC_TITLE = {"data-model.md": "Data model", "permission-matrix.md": "Permission matrix", "architecture.md": "Architecture", "user-flows.md": "User flows",
             "wireframes.md": "Wireframes", "test-cases.md": "Test cases", "requirements-audit.md": "Requirements audit", "field-matrix.md": "Field matrix",
             "decision-log.md": "Decision log", "decision-register.md": "Decision register"}

OPEN_ITEMS = [
    ("Demo duration and limits", ["Q3", "Q10"], True, "How long demo access lasts, and the final number of locations and hotels it shows. AMPM's brief says up to three locations.", "Sets the demo configuration and the demo seed data; small effect on the estimate."),
    ("Demo hotel count per location", ["Q3"], False, "Whether the demo shows one or two sample hotels per location with indicative prices; AMPM's notes mention both.", "Seed data only."),
    ("Payment gateway provider", ["Q2"], True, "Which gateway, and any transaction-handling requirements beyond card and UPI. The merchant account takes one to two weeks to open.", "Chooses the adapter and starts the onboarding clock."),
    ("Representative logins: shared or separate", ["Q5"], True, "Whether the two family representatives share one login or have separate authenticated accounts on the same wedding. AMPM's brief and the design both prefer separate accounts, so each approval carries a name.", "Separate accounts are assumed; a shared login would remove per-person audit history."),
    ("Final staff roles and cost access", ["Q6"], True, "The final staff role list, and which internal users may see hotel costs and vendor costs. AMPM confirmed department-based access and named the departments as examples.", "Changes role seed data and the cost-visibility tiers; no structural change."),
    ("Hosting, backup location and recovery targets", ["Q14"], True, "Hosting provider and region, backup location, and the recovery point and time AMPM expects. The recommendation is an Indian region with a second Indian copy, fifteen minutes and four hours.", "Determines the infrastructure bill of materials in the estimate."),
    ("Initial capacity: staff, hotels, weddings, guests", ["Q15"], True, "AMPM gave about 200 hotels and 20 concurrent weddings; staff count and the largest guest count are missing.", "Scales the load profiles and the infrastructure sizing in the estimate."),
    ("WhatsApp and SMS providers", ["Q11", "Q13"], True, "Who provides WhatsApp and SMS. Both carry registration lead times of two to six weeks, and OTP sign-in depends on SMS, so this gates the launch.", "Chooses the adapters and starts the registration clock."),
    ("Privacy wording and retention periods", ["Q17", "Q8"], False, "The privacy wording for the enquiry form and the guest pages, and retention periods for leads, guest records and identity documents. Nothing is deleted without AMPM's approval.", "Copy and configuration values."),
    ("Material-change thresholds and approval rules", ["Q25"], False, "The budget percentage, date and venue thresholds that make a change material, and the approval rules around them.", "Configuration values."),
    ("Archiving workflow", ["Q23"], False, "The exact steps for archiving a wedding after the three-month window and for restoring access afterwards.", "A status and permission workflow; no structural change."),
    ("Client portal on the web as well as the apps", ["Q1"], True, "AMPM asked for iOS and Android apps. Whether the client portal also needs a web version, for example for reviewing designs on a laptop, is not stated. A React Native Web build from the same code would provide it.", "Adds or removes a web build from the estimate."),
    ("Client-facing amounts in the wedding portal", ["Q4"], False, "AMPM ruled out internal costs, margins and vendor rates and set the wedding fee outside the app, but did not say which client-facing amounts the wedding portal shows: a budget summary, approved amounts, payment status.", "Decides the client budget and payment screens; no structural change."),
]
LOG_NOTES = {
    "2026-10-23 Requirements audit": "The five brief documents were audited: 9 conflicts, 44 gaps, 15 ambiguities, 8 risks and 25 decisions for AMPM. See [[Findings]] and [[Decisions]]. Document: [[requirements-audit|Requirements audit]].",
    "2026-10-23 Design drafts under assumptions": "The data model, permission matrix, field matrix, architecture, user flows, wireframes and test cases were drafted before AMPM answered anything; every design choice that depended on an answer was tagged with an assumption that cites its question. See [[Assumptions]].",
    "2026-10-24 Review set and shared pages": "An AMPM-facing review set was written (annotated brief, redrawn flowcharts, plain-language decisions, assumptions sheet, decision brief) and published as two shared pages. The full package: https://claude.ai/artifact/55fJPFQnnqi8sVVU7FUFcv. The short decision brief: https://claude.ai/artifact/1VSdFMEAXfqj8V6NzkjPG3.",
    "2026-10-25 AMPM answers received": "AMPM answered all 25 questions in two documents, filed under reference_docs/answers. The answers were recorded in docs/decisions.json, stamped on every assumption, and applied to each draft (version 0.2). Eleven points remain to confirm, plus two from our side. See [[Decisions]] and [[Open items]].",
    "2026-10-25 Estimate held": "The milestone schedule and cost estimate are held until AMPM confirms the remaining points, in particular capacity, the launch shape (one release or hotel discovery first) and whether the client portal is apps only or also web.",
    "2026-10-26 Obsidian vault": "The project folder was set up as an Obsidian vault. Generated notes live under notes/ and are rebuilt by docs/tools/vault_build.py; open items and log notes are written once and kept. The source of truth for decisions stays docs/decisions.json: record an answer in the open item's note, then update the JSON and rebuild.",
}


def q_titles():
    out, tier = {}, None
    for line in AUDIT.split("\n"):
        m = re.match(r"^### Tier (\d) ", line)
        if m:
            tier = int(m.group(1))
        m = re.match(r"^- \*\*Q(\d+)\b([^*]*)\*\*\s*(.*)$", line)
        if m and tier:
            inside, after = m.group(2).strip(" ."), m.group(3).strip()
            title = inside if inside else re.split(r"[.?]|\s\(", after, maxsplit=1)[0].strip()
            body = after if inside else after
            out[int(m.group(1))] = dict(title=title, tier=tier, text=body, findings=re.findall(r"\b((?:GP|AM|CF|RK)-\d+)\b", after))
    return out


def findings():
    out = {}
    for m in re.finditer(r"^### (CF-\d+) — (.+?)\n(.*?)(?=^### |^---)", AUDIT, re.M | re.S):
        out[m.group(1)] = dict(kind="conflict", title=m.group(2).strip(), body=m.group(3).strip())
    for kind, prefix in (("gap", "GP"), ("ambiguity", "AM"), ("risk", "RK")):
        for m in re.finditer(r"^- \*\*(%s-\d+) (.+?)\.?\*\*\s*(.*)$" % prefix, AUDIT, re.M):
            out[m.group(1)] = dict(kind=kind, title=m.group(2).strip(), body=m.group(3).strip())
    return out


def resolutions():
    dm = (DOCS / "data-model.md").read_text(encoding="utf8")
    sec = dm.split("### 20.2")[1].split("Not resolved by a data model")[0]
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^\| ((?:GP|AM)-\d+)[^|]*\| ([^|]*)\|$", sec, re.M)}


def registers():
    rows = {}
    for fname, prefix, label in REGISTERS:
        text = (DOCS / fname).read_text(encoding="utf8")
        for rid, ref, assumption, otherwise in ROW.findall(text):
            if rid.startswith(prefix + "-"):
                rows[rid] = dict(doc=fname, label=label, ref=ref.strip(), text=MARK.sub("", assumption.strip()), otherwise=otherwise.strip())
    return rows


def safe(name):
    return re.sub(r"[\\/:*?\"<>|#^\[\]]", "", name).replace("  ", " ").strip()


def qnote_name(n, titles):
    return safe(f"Q{n:02d} {titles[n]['title']}")


def write(path, text, overwrite=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not overwrite:
        return False
    path.write_text(text, encoding="utf8")
    return True


def build():
    titles, finds, res, rows = q_titles(), findings(), resolutions(), registers()
    today = date.today().isoformat()
    asm_by_q = defaultdict(list)
    for rid, r in rows.items():
        for q in re.findall(r"\bQ(\d+)\b", r["ref"]):
            asm_by_q[int(q)].append(rid)
    asm_by_finding = defaultdict(list)
    for rid, r in rows.items():
        for f in re.findall(r"\b((?:GP|AM|CF|RK)-\d+)\b", r["ref"]):
            asm_by_finding[f].append(rid)
    q_by_finding = defaultdict(list)
    for n, t in titles.items():
        for f in t["findings"]:
            q_by_finding[f].append(n)
    counts = {"decisions": 0, "assumptions": 0, "findings": 0, "open": 0, "open_new": 0, "log_new": 0}

    # ---- decisions
    for n, t in sorted(titles.items()):
        q = DEC["questions"][f"Q{n}"]
        name = qnote_name(n, titles)
        aff = q["affects"]
        lines = ["---", "type: decision", f"id: Q{n}", f"tier: {t['tier']}", f"status: {q['status']}", f"decided_on: {DEC['answered_on']}",
                 f"tags: [ampm, decision, tier-{t['tier']}, status/{q['status']}]", "generated: true", "---",
                 f"# Q{n} {t['title']}\n", f"**Tier.** {TIER_NAME[t['tier']]}.", f"**Status.** {QLABEL[q['status']]}.\n",
                 "## The question\n", t["text"] + "\n", f"## AMPM's decision ({DEC['answered_on']})\n", q["decision"] + "\n"]
        if q["open"]:
            lines += ["## Still open\n"] + [f"- {o}" for o in q["open"]] + [""]
        lines += ["## Assumptions this answer confirms or changes\n", "| Assumption | Status | Note |", "|---|---|---|"]
        for aid in aff:
            a = DEC["assumptions"][aid]
            lines.append(f"| [[{aid}]] | {LABEL[a['status']]} | {a['note']} |")
        extra = [aid for aid in asm_by_q.get(n, []) if aid not in aff]
        if extra:
            lines += ["", "Also citing this question: " + ", ".join(f"[[{aid}]]" for aid in extra)]
        if t["findings"]:
            lines += ["", "## Findings behind the question\n"] + [f"- [[{f}]] {finds[f]['title']}" for f in t["findings"] if f in finds]
        lines += ["", "## Where to read more\n", "- [[decision-log|Decision log]], [[decision-register|Decision register]], [[requirements-audit|Requirements audit]] §11",
                  "- Open items linked to this question: " + (", ".join(f"[[{safe(o[0])}]]" for o in OPEN_ITEMS if f"Q{n}" in o[1]) or "none"),
                  "", f"*Generated from docs/decisions.json on {today}; edit the JSON and rebuild, not this note.*"]
        write(NOTES / "Decisions" / f"{name}.md", "\n".join(lines) + "\n")
        counts["decisions"] += 1

    # ---- assumptions
    for rid, r in rows.items():
        d = DEC["assumptions"].get(rid, {"status": "stands", "note": "Not addressed."})
        qs = [int(x) for x in re.findall(r"\bQ(\d+)\b", r["ref"])]
        fs = re.findall(r"\b((?:GP|AM|CF|RK)-\d+)\b", r["ref"])
        reg = r["doc"].replace(".md", "")
        lines = ["---", "type: assumption", f"id: {rid}", f"register: {reg}", f"status: {d['status']}",
                 "questions: [" + ", ".join(f"Q{q}" for q in qs) + "]", f"tags: [ampm, assumption, register/{reg}, status/{d['status']}]", "generated: true", "---",
                 f"# {rid}\n", f"**Register.** [[{reg}|{r['label']}]] §0 · **Depends on.** " + (", ".join(f"[[{qnote_name(q, titles)}]]" for q in qs if q in titles) or "no question") + ("; findings " + ", ".join(f"[[{f}]]" for f in fs) if fs else "") + "\n",
                 "## Assumed (23 October 2026)\n", r["text"] + "\n", "## If AMPM decides otherwise\n", r["otherwise"] + "\n",
                 f"## AMPM's decision ({DEC['answered_on']})\n", f"**{LABEL[d['status']]}.** {d['note']}\n",
                 f"*Generated on {today} from the register in docs/{r['doc']} and docs/decisions.json.*"]
        write(NOTES / "Assumptions" / f"{rid}.md", "\n".join(lines) + "\n")
        counts["assumptions"] += 1

    # ---- findings
    for fid, f in finds.items():
        qs = q_by_finding.get(fid, [])
        lines = ["---", "type: finding", f"id: {fid}", f"kind: {f['kind']}", f"title: \"{f['title'].replace(chr(34), chr(39))}\"",
                 "questions: [" + ", ".join(f"Q{q}" for q in qs) + "]", f"tags: [ampm, finding, {f['kind']}]", f"aliases: [\"{fid} {f['title'].replace(chr(34), chr(39))}\"]", "generated: true", "---",
                 f"# {fid} {f['title']}\n", f"**Kind.** {f['kind'].capitalize()} (requirements audit, 23 October 2026).\n", f["body"] + "\n"]
        if fid in res:
            lines += ["## How the design resolved it\n", res[fid] + " (data model §20.2)\n"]
        lines += ["## Linked\n", "- Questions: " + (", ".join(f"[[{qnote_name(q, titles)}]]" for q in qs) or "none"),
                  "- Assumptions citing it: " + (", ".join(f"[[{a}]]" for a in asm_by_finding.get(fid, [])) or "none"),
                  "- Source: [[requirements-audit|Requirements audit]]; in context in [[annotated-brief|the annotated brief]]", "", f"*Generated on {today}.*"]
        write(NOTES / "Findings" / f"{fid}.md", "\n".join(lines) + "\n")
        counts["findings"] += 1

    # ---- open items (never overwritten)
    for i, (title, qs, est, need, why) in enumerate(OPEN_ITEMS, 1):
        lines = ["---", "type: open-item", f"id: OI-{i}", "status: open", "owner: AMPM", "raised_on: 2026-10-25", f"affects_estimate: {'true' if est else 'false'}",
                 "questions: [" + ", ".join(qs) + "]", "tags: [ampm, open-item, status/open]", "---",
                 f"# {title}\n", f"**What we need.** {need}\n", f"**Why it matters.** {why}\n",
                 "**Linked questions.** " + ", ".join(f"[[{qnote_name(int(q[1:]), titles)}]]" for q in qs) + "\n",
                 "## Answer\n", "_Record AMPM's confirmation here with the date, set `status: confirmed` above, then update docs/decisions.json and run the generators._\n"]
        if write(NOTES / "Open items" / f"{safe(title)}.md", "\n".join(lines) + "\n", overwrite=False):
            counts["open_new"] += 1
        counts["open"] += 1

    # ---- log notes (never overwritten)
    for name, body in LOG_NOTES.items():
        text = f"---\ntype: log\ndate: {name[:10]}\ntags: [ampm, log]\n---\n# {name[11:]}\n\n{body}\n"
        if write(NOTES / "Log" / f"{name}.md", text, overwrite=False):
            counts["log_new"] += 1

    # ---- index notes
    qc = defaultdict(int)
    for q in DEC["questions"].values():
        qc[q["status"]] += 1
    idx = ["---\ntype: index\ntags: [ampm, index]\n---\n# Decisions\n",
           f"All 25 questions AMPM was asked, with its answers of {DEC['answered_on']}: {qc['decided']} decided, {qc['partly']} partly decided, {qc['open']} still open.\n",
           "| Q | Question | Tier | Status | Open points |", "|---|---|---|---|---|"]
    for n, t in sorted(titles.items()):
        q = DEC["questions"][f"Q{n}"]
        idx.append(f"| [[{qnote_name(n, titles)}|Q{n}]] | {t['title']} | {t['tier']} | {QLABEL[q['status']]} | {len(q['open'])} |")
    write(NOTES / "Decisions.md", "\n".join(idx) + "\n")
    ac = defaultdict(int)
    for a in DEC["assumptions"].values():
        ac[a["status"]] += 1
    idx = ["---\ntype: index\ntags: [ampm, index]\n---\n# Assumptions\n",
           f"The 98 assumptions made in place of answers, with AMPM's decision applied: " + ", ".join(f"{v} {LABEL[k].lower()}" for k, v in sorted(ac.items(), key=lambda kv: -kv[1])) + ".\n",
           "| ID | Register | Depends on | Status | Assumed |", "|---|---|---|---|---|"]
    for rid, r in rows.items():
        d = DEC["assumptions"].get(rid, {"status": "stands"})
        idx.append(f"| [[{rid}]] | {r['label']} | {r['ref']} | {LABEL[d['status']]} | {r['text'][:110].rstrip()}{'…' if len(r['text']) > 110 else ''} |")
    write(NOTES / "Assumptions.md", "\n".join(idx) + "\n")
    idx = ["---\ntype: index\ntags: [ampm, index]\n---\n# Findings\n", "From the requirements audit of 23 October 2026: 9 conflicts, 44 gaps, 15 ambiguities, 8 risks.\n",
           "| ID | Kind | Title | Questions |", "|---|---|---|---|"]
    for fid in sorted(finds, key=lambda s: (s.split("-")[0], int(s.split("-")[1]))):
        f = finds[fid]
        idx.append(f"| [[{fid}]] | {f['kind']} | {f['title']} | {', '.join(f'Q{q}' for q in q_by_finding.get(fid, [])) or '—'} |")
    write(NOTES / "Findings.md", "\n".join(idx) + "\n")
    idx = ["---\ntype: index\ntags: [ampm, index]\n---\n# Open items\n",
           "Points still to confirm after AMPM's answers of 25 October 2026: AMPM's own eleven, plus two from our side. The estimate is held until they are confirmed. Record each answer in its note.\n",
           "| # | Item | Questions | Affects the estimate |", "|---|---|---|---|"]
    for i, (title, qs, est, need, why) in enumerate(OPEN_ITEMS, 1):
        idx.append(f"| {i} | [[{safe(title)}]] | {', '.join(qs)} | {'yes' if est else 'no'} |")
    write(NOTES / "Open items.md", "\n".join(idx) + "\n")
    docs_idx = ["---\ntype: index\ntags: [ampm, index]\n---\n# Documents\n", "The design package under docs/, version 0.2 with AMPM's decisions applied. Diagrams render in Obsidian.\n",
                "## For AMPM\n", "- [[decision-brief|Decision brief]]: the short version with AMPM's answers", "- [[annotated-brief|Your brief, annotated]]", "- [[redesigned-flowcharts|Your flowcharts, redrawn]]",
                "- [[open-decisions|Decisions we need from you]] (answered)", "- [[assumptions-taken|Assumptions we took]]", "", "## Developer drafts\n",
                "- [[decision-log|Decision log]] (generated from decisions.json)", "- [[requirements-audit|Requirements audit]]", "- [[decision-register|Decision register]] (generated)",
                "- [[user-flows|User flows]]", "- [[wireframes|Wireframes]]", "- [[data-model|Data model]]", "- [[permission-matrix|Permission matrix]]",
                "- [[field-matrix|Field matrix]] (generated)", "- [[architecture|Architecture and integration plan]]", "- [[test-cases|Test cases]]", "", "## Guide\n", "- [[README|Package README]] with the regeneration commands"]
    write(NOTES / "Documents.md", "\n".join(docs_idx) + "\n")
    src = ["---\ntype: index\ntags: [ampm, index]\n---\n# Sources\n", "AMPM's own documents, in reference_docs/.\n", "## The brief (October 2026)\n",
           "- [[AMPM Website & App —  Business Explanation for Developer.pdf|Business explanation for the developer]]", "- [[Why AMPM App.pdf|Why AMPM App]]",
           "- AMPM_Developer_Technical_Specification_v1.docx (Word; the text is reproduced in [[annotated-brief|the annotated brief]])",
           "- [[AMPM_App_Visual_Flowchart-for team.pdf|Team app flowchart]]", "- [[AMPM_Client_Portal_Visual_Flowchart.pdf|Client portal flowchart]]", "", "## AMPM's answers (25 October 2026)\n",
           "- [[AMPM App – Compiled Questions & Answers.pdf|Compiled questions and answers]]", "- [[AMPM app brief updated answer.pdf|Final app decision brief and developer requirements]]"]
    write(NOTES / "Sources.md", "\n".join(src) + "\n")

    home = ["---\ntype: hub\ntags: [ampm, hub]\n---\n# AMPM Platform\n",
            f"Wedding-planning platform for AMPM. Design drafts at version 0.2 with AMPM's decisions of {DEC['answered_on']} applied; the schedule and cost estimate are held until the open items are confirmed.\n",
            "## Start here\n", "- [[Decisions]]: the 25 questions and AMPM's answers", "- [[Open items]]: what still needs confirming, and where to record the answers",
            "- [[Assumptions]]: the 98 assumptions and their status", "- [[Findings]]: the audit's conflicts, gaps, ambiguities and risks", "- [[Documents]]: the design package", "- [[Sources]]: AMPM's own documents",
            "- Log: " + ", ".join(f"[[{n}]]" for n in LOG_NOTES), "", "## Status\n",
            f"| | |", "|---|---|", f"| Questions | {qc['decided']} decided, {qc['partly']} partly, {qc['open']} open |",
            f"| Assumptions | " + ", ".join(f"{v} {LABEL[k].lower()}" for k, v in sorted(ac.items(), key=lambda kv: -kv[1])) + " |",
            f"| Open items | {len(OPEN_ITEMS)} |", "| Shared pages | [Full package](https://claude.ai/artifact/55fJPFQnnqi8sVVU7FUFcv) · [Decision brief](https://claude.ai/artifact/1VSdFMEAXfqj8V6NzkjPG3) |", "",
            "## How this vault works\n", "- The documents under docs/ are a synced copy of the design package in the project repository (ampm-platform); edit them there, not here. They render with their diagrams.",
            "- The notes under notes/ are generated from the project's docs/decisions.json, the audit and the assumption registers by `docs/tools/vault_build.py` in the project repository. Decision, assumption and finding notes are rebuilt each run; open items and log notes are written once and kept.",
            "- Every project commit, the end of every Claude Code turn and a ten-minute timer run `docs/tools/vault_sync.py` in the project repository: it copies the documents in, rebuilds the notes, appends to the day's sync log and commits this vault to its repository (ampm-vault). Notes you edit here in Obsidian are committed by the timer.",
            "- To record a confirmation from AMPM: write it in the open item's note, update docs/decisions.json, then run `apply_decisions.py`, `decision_log_build.py`, the register and sheet generators, `vault_build.py` and `site_build.mjs`.",
            f"\n*Home regenerated on {today}.*"]
    write(ROOT / "Home.md", "\n".join(home) + "\n")
    print(f"decisions {counts['decisions']}, assumptions {counts['assumptions']}, findings {counts['findings']}, open items {counts['open']} ({counts['open_new']} new), log notes {counts['log_new']} new; indexes and Home written")


if __name__ == "__main__":
    build()
