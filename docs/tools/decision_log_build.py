#!/usr/bin/env python3
"""Build docs/decision-log.md from docs/decisions.json: AMPM's answer to every question, its status, the assumptions it
confirms or changes, the open points, the additional requirements AMPM added, and the items still to confirm.
Run: python3 docs/tools/decision_log_build.py
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
OUT = DOCS / "decision-log.md"
DEC = json.loads((DOCS / "decisions.json").read_text(encoding="utf8"))
LABEL = {"confirmed": "Confirmed", "changed": "Changed", "partly": "Partly decided", "dropped": "Dropped", "open": "Still open", "stands": "Not addressed, stands"}
QLABEL = {"decided": "Decided", "partly": "Partly decided", "open": "Still open"}
REG = {"A": "data-model.md", "P": "permission-matrix.md", "T": "architecture.md", "U": "user-flows.md", "W": "wireframes.md", "V": "test-cases.md"}


def q_titles():
    au = (DOCS / "requirements-audit.md").read_text(encoding="utf8")
    out, tier = {}, None
    for line in au.split("\n"):
        m = re.match(r"^### Tier (\d) ", line)
        if m:
            tier = int(m.group(1))
        m = re.match(r"^- \*\*Q(\d+)\b([^*]*)\*\*\s*(.*)$", line)
        if m and tier:
            inside, after = m.group(2).strip(" ."), m.group(3).strip()
            out[int(m.group(1))] = (inside if inside else re.split(r"[.?]|\s\(", after, maxsplit=1)[0].strip(), tier)
    return out


def build():
    titles = q_titles()
    qs, asm = DEC["questions"], DEC["assumptions"]
    qc, ac = Counter(v["status"] for v in qs.values()), Counter(v["status"] for v in asm.values())
    out = [f"# AMPM Platform — Decision Log\n",
           f"**Status:** AMPM's decisions of {DEC['answered_on']}" + (f", with the round-two decisions of {DEC['round_two']['decided_on']} ({DEC['round_two']['decided_by']}) where marked" if DEC.get("round_two") else "") + ", generated from `docs/decisions.json` by `docs/tools/decision_log_build.py`. Do not edit by hand; change the JSON and rebuild.",
           "**Sources:** " + "; ".join(DEC["sources"]) + ".\n",
           "This log is the record of what AMPM decided, question by question, and what each answer does to the assumptions the drafts were built on. "
           "The assumption registers in every draft carry the same markers; the generated decision register and assumptions sheet show them too.\n",
           "## Summary\n",
           "| | Count |", "|---|---|",
           f"| Questions decided | {qc['decided']} |", f"| Questions partly decided (an open point remains) | {qc['partly']} |", f"| Questions still open | {qc['open']} |",
           f"| Assumptions confirmed | {ac['confirmed']} |", f"| Assumptions changed | {ac['changed']} |", f"| Assumptions partly decided | {ac['partly']} |",
           f"| Assumptions dropped | {ac['dropped']} |", f"| Assumptions still open | {ac['open']} |", f"| Assumptions not addressed, standing | {ac['stands']} |\n"]
    for tier in (1, 2, 3):
        names = {1: "Tier 1", 2: "Tier 2", 3: "Tier 3"}
        out.append(f"## {names[tier]}\n")
        for n in sorted(titles):
            title, t = titles[n]
            if t != tier:
                continue
            q = qs[f"Q{n}"]
            out.append(f"### Q{n} {title} — {QLABEL[q['status']]}\n")
            out.append(f"**AMPM decided.** {q['decision']}\n")
            if q["open"]:
                out.append("**Still open.** " + " ".join(f"{i + 1}. {o}." for i, o in enumerate(q["open"])) + "\n")
            out.append("| Assumption | Status | What AMPM's answer means for it |")
            out.append("|---|---|---|")
            for aid in q["affects"]:
                a = asm[aid]
                out.append(f"| {aid} ([{REG[aid[0]]}]({REG[aid[0]]}) §0) | {LABEL[a['status']]} | {a['note']} |")
            out.append("")
    out.append("## Requirements AMPM added beyond the questions\n")
    for r in DEC["additional_requirements"]:
        out.append(f"- {r}")
    out.append("\n## Items AMPM listed to confirm before development\n")
    for i, r in enumerate(DEC["items_to_confirm"], 1):
        st = DEC.get("items_to_confirm_status", {}).get(str(i))
        out.append(f"{i}. {r}" + (f" — {st}." if st else ""))
    out.append("\n## Assumptions by status\n")
    for status in ("changed", "dropped", "partly", "open", "confirmed", "stands"):
        ids = [k for k, v in asm.items() if v["status"] == status]
        out.append(f"**{LABEL[status]} ({len(ids)}):** " + ", ".join(ids) + "\n")
    OUT.write_text("\n".join(out) + "\n", encoding="utf8")
    print(f"wrote {OUT.name}: {len(qs)} questions, {len(asm)} assumptions")


if __name__ == "__main__":
    build()
