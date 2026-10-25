#!/usr/bin/env python3
"""Build docs/decision-register.md: every assumption from the six assumption registers, indexed by the audit
question it depends on, so AMPM can answer a question and see everything that changes.

Inputs:  docs/requirements-audit.md (Q titles and tiers) and the §0 registers of data-model.md, permission-matrix.md,
         architecture.md, user-flows.md, wireframes.md, test-cases.md
Run:     python3 docs/tools/decision_register_build.py
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
OUT = DOCS / "decision-register.md"
REGISTERS = [  # (file, id prefix, label)
    ("data-model.md", "A", "Data model"),
    ("permission-matrix.md", "P", "Permission matrix"),
    ("architecture.md", "T", "Architecture"),
    ("user-flows.md", "U", "User flows"),
    ("wireframes.md", "W", "Wireframes"),
    ("test-cases.md", "V", "Test cases"),
]
ROW = re.compile(r"^\| ([APTUWV]-\d+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$", re.M)


def audit_questions(text: str):
    """Return {n: (title, tier)} from requirements-audit.md §11."""
    out = {}
    tier = None
    for line in text.split("\n"):
        m = re.match(r"^### Tier (\d) ", line)
        if m:
            tier = int(m.group(1))
        m = re.match(r"^- \*\*Q(\d+)\b([^*]*)\*\*\s*(.*)$", line)
        if m and tier:
            inside, after = m.group(2).strip(" ."), m.group(3).strip()
            title = inside if inside else re.split(r"[.?]|\s\(", after, maxsplit=1)[0].strip()
            out[int(m.group(1))] = (title, tier)
    return out


DEC_PATH = DOCS / "decisions.json"
DEC = json.loads(DEC_PATH.read_text(encoding="utf8")) if DEC_PATH.exists() else None
LABEL = {"confirmed": "Confirmed", "changed": "Changed", "partly": "Partly decided", "dropped": "Dropped", "open": "Still open", "stands": "Not addressed, stands"}
MARK = re.compile(r"\s*\*\*AMPM \(\d{4}-\d{2}-\d{2}\): [^*]*\*\*\s*$")


def build():
    audit = (DOCS / "requirements-audit.md").read_text(encoding="utf8")
    questions = audit_questions(audit)
    if len(questions) != 25:
        raise SystemExit(f"expected 25 audit questions, found {len(questions)}")
    by_q = defaultdict(list)
    by_other = defaultdict(list)
    rows = []
    for fname, prefix, label in REGISTERS:
        text = (DOCS / fname).read_text(encoding="utf8")
        found = ROW.findall(text)
        found = [r for r in found if r[0].startswith(prefix + "-")]
        if not found:
            raise SystemExit(f"no register rows found in {fname}")
        for rid, ref, assumption, otherwise in found:
            rows.append((rid, fname, label, ref.strip(), MARK.sub("", assumption.strip()), otherwise.strip()))
            qs = {int(q) for q in re.findall(r"\bQ(\d+)\b", ref)}
            for q in qs:
                by_q[q].append(rows[-1])
            if not qs:
                for other in re.findall(r"\b(?:GP|AM|CF|RK)-\d+\b", ref) or ["(no audit reference)"]:
                    by_other[other].append(rows[-1])

    out = []
    out.append("# AMPM Platform — Decision Register\n")
    out.append(f"**Status:** generated {date.today().isoformat()} by `docs/tools/decision_register_build.py` from the "
               "assumption registers in the six design drafts and the question list in "
               "[requirements-audit.md](requirements-audit.md) §11. Do not edit by hand; change a register and rebuild.\n")
    out.append("For each audit question, this lists every assumption that was made in its place. Answering the question "
               "confirms or replaces those assumptions; the \"If AMPM decides otherwise\" column says what changes. "
               "Tier 1 questions gate design sign-off; Tier 2 must be answered before the Phase 1 build; Tier 3 before Phases 2 to 4.\n")
    if DEC:
        out.append(f"**AMPM answered on {DEC['answered_on']}.** Each question below carries the decision and each assumption its status; the full record is [decision-log.md](decision-log.md).\n")
    out.append("## Summary\n")
    out.append("| Register | Document | Assumptions | Tied to a question | Tied only to an audit finding |")
    out.append("|---|---|---|---|---|")
    for fname, prefix, label in REGISTERS:
        mine = [r for r in rows if r[0].startswith(prefix + "-")]
        with_q = sum(1 for r in mine if re.search(r"\bQ\d+\b", r[3]))
        out.append(f"| {prefix} | [{fname}]({fname}) §0 ({label}) | {len(mine)} | {with_q} | {len(mine) - with_q} |")
    total_q = sum(1 for r in rows if re.search(r"\bQ\d+\b", r[3]))
    out.append(f"| **Total** | | **{len(rows)}** | **{total_q}** | **{len(rows) - total_q}** |\n")

    for tier in (1, 2, 3):
        names = {1: "Tier 1 — blocking design sign-off", 2: "Tier 2 — before the Phase 1 build", 3: "Tier 3 — before Phases 2 to 4"}
        out.append(f"## {names[tier]}\n")
        for q in sorted(questions):
            title, t = questions[q]
            if t != tier:
                continue
            deps = by_q.get(q, [])
            out.append(f"### Q{q} {title}\n")
            if DEC and f"Q{q}" in DEC["questions"]:
                qd = DEC["questions"][f"Q{q}"]
                out.append(f"**AMPM decided ({DEC['answered_on']}).** {qd['decision']}" + (" **Still open:** " + "; ".join(qd["open"]) + "." if qd["open"] else "") + "\n")
            out.append(f"Dependent assumptions: **{len(deps)}**" + ("" if deps else " (none; the answer changes copy or configuration only)") + "\n")
            if deps:
                out.append("| ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |")
                out.append("|---|---|---|---|---|")
                for rid, fname, label, ref, assumption, otherwise in deps:
                    st = DEC["assumptions"].get(rid) if DEC else None
                    cell = f"{LABEL[st['status']]}. {st['note']}" if st else ""
                    out.append(f"| {rid} | [{label}]({fname}) | {assumption} | {otherwise} | {cell} |")
            out.append("")

    out.append("## Assumptions tied to an audit finding rather than a question\n")
    out.append("These resolve an ambiguity, conflict or gap the audit recorded; AMPM confirms them by reviewing the finding.\n")
    out.append("| Finding | ID | Where | Assumption adopted | If AMPM decides otherwise | AMPM's decision |")
    out.append("|---|---|---|---|---|---|")
    for other in sorted(by_other, key=lambda s: (s.split("-")[0], int(s.split("-")[1]) if "-" in s and s.split("-")[1].isdigit() else 0)):
        for rid, fname, label, ref, assumption, otherwise in by_other[other]:
            st = DEC["assumptions"].get(rid) if DEC else None
            cell = f"{LABEL[st['status']]}. {st['note']}" if st else ""
            out.append(f"| {other} | {rid} | [{label}]({fname}) | {assumption} | {otherwise} | {cell} |")
    out.append("")
    out.append("## Where each document keeps its own open questions\n")
    out.append("| Document | Section |")
    out.append("|---|---|")
    for fname, heading in (("requirements-audit.md", "§11 Decisions required from AMPM"), ("data-model.md", "§21 Open modelling questions"),
                           ("permission-matrix.md", "§11 Open questions for review"), ("architecture.md", "§15 Decisions for AMPM"),
                           ("user-flows.md", "§15 Open questions raised by the flows"), ("wireframes.md", "§12 Open questions for the screen review"),
                           ("test-cases.md", "§9 Coverage summary and open questions")):
        out.append(f"| [{fname}]({fname}) | {heading} |")
    OUT.write_text("\n".join(out) + "\n", encoding="utf8")
    print(f"{len(rows)} assumptions across {len(REGISTERS)} registers; questions with dependants: {sum(1 for q in questions if by_q.get(q))}/25; wrote {OUT.name}")


if __name__ == "__main__":
    build()
