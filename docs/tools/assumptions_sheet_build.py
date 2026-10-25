#!/usr/bin/env python3
"""Build docs/review/assumptions-taken.md: every assumption from the six registers, grouped by business theme,
with a column for AMPM to confirm or change each one.

Run: python3 docs/tools/assumptions_sheet_build.py
"""
from __future__ import annotations

import json
import re
from collections import OrderedDict
from datetime import date
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
OUT = DOCS / "review" / "assumptions-taken.md"
REGISTERS = [
    ("data-model.md", "A", "Data model"), ("permission-matrix.md", "P", "Permission matrix"),
    ("architecture.md", "T", "Architecture"), ("user-flows.md", "U", "User flows"),
    ("wireframes.md", "W", "Wireframes"), ("test-cases.md", "V", "Test cases"),
]
ROW = re.compile(r"^\| ([APTUWV]-\d+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$", re.M)
DEC_PATH = DOCS / "decisions.json"
DEC = json.loads(DEC_PATH.read_text(encoding="utf8")) if DEC_PATH.exists() else None
LABEL = {"confirmed": "Confirmed", "changed": "Changed", "partly": "Partly decided", "dropped": "Dropped", "open": "Still open", "stands": "Not addressed, stands"}
MARK = re.compile(r"\s*\*\*AMPM \(\d{4}-\d{2}-\d{2}\): [^*]*\*\*\s*$")

THEMES = OrderedDict([
    ("Commercial model and access", """A-2 A-3 A-10 A-28 A-29 P-7 U-1 U-2 U-3 V-1 V-10 V-11 W-1 W-15 T-3 T-10"""),
    ("Roles, permissions and client users", """A-5 A-6 P-1 P-2 P-3 P-9 P-11 U-4 V-14 W-5 A-22"""),
    ("Hotels and hotel assistance", """A-9 A-27 A-18 W-14"""),
    ("Wedding planning, approvals and money", """A-4 A-16 A-20 A-21 A-25 A-26 U-6 U-11 U-12 V-8 V-12 W-8 W-12"""),
    ("Guests, RSVP and privacy", """A-7 A-8 A-17 A-19 A-23 A-24 P-4 P-5 P-10 U-5 U-8 V-6 V-7 V-9 V-15 W-6 W-9 W-13"""),
    ("Operations and the wedding day", """P-8 U-7 V-4 W-10 T-11 T-14"""),
    ("Technology, hosting and delivery", """A-1 A-11 A-12 A-13 A-14 A-15 A-30 P-6 T-1 T-2 T-4 T-5 T-6 T-7 T-8 T-9 T-12 T-13 U-9 U-10 V-2 V-3 V-5 V-13 V-16 W-2 W-3 W-4 W-7 W-11"""),
])
INTRO = {
    "Commercial model and access": "How clients get access, pay, and what a subscription or a demo includes.",
    "Roles, permissions and client users": "Who may see and do what, and how the couple and family use the portal.",
    "Hotels and hotel assistance": "How hotel information, prices and availability are kept and shown.",
    "Wedding planning, approvals and money": "How budgets, proposals, approvals and client requests work.",
    "Guests, RSVP and privacy": "How guests respond, what is collected about them, and how long it is kept.",
    "Operations and the wedding day": "What staff can do on site and who may override a check.",
    "Technology, hosting and delivery": "Platform, hosting, providers and how the system is built and tested.",
}


def build():
    rows = {}
    for fname, prefix, label in REGISTERS:
        text = (DOCS / fname).read_text(encoding="utf8")
        for rid, ref, assumption, otherwise in ROW.findall(text):
            if rid.startswith(prefix + "-"):
                rows[rid] = (label, fname, ref.strip(), MARK.sub("", assumption.strip()), otherwise.strip())
    placed = set()
    out = ["# AMPM Platform — Assumptions We Took on Your Behalf\n",
           f"**For:** AMPM review · **Date:** {date.today().isoformat()} · **Status:** " + (f"AMPM's decisions of {DEC['answered_on']} applied; the last two columns show what AMPM decided for each line." if DEC else "every line below is a placeholder for your answer, not a decision we made for you.") + "\n",
           "Your brief says the developer must not invent business policies. We respected that by drafting the design with explicit assumptions wherever a question was open, each tagged with the question it stands in for. This sheet lists all of them in plain groups. " + ("Lines marked Changed or Dropped are being reworked in the design; lines marked Still open or Partly decided wait for the items AMPM listed to confirm; the rest stand as written." if DEC else "For each line, tick **Confirm** if the assumption matches what you want, or write what should change in **Your call**.") + " The Depends on column names the audit question (Q), finding (GP, CF, AM) or earlier assumption each line rests on; the questions themselves are in [the open decisions document](open-decisions.md).\n",
           "Identifier prefixes: **A** data model, **P** permissions, **T** technology, **U** user flows, **W** screens, **V** testing.\n"]
    total = 0
    sec = 1
    for theme, ids in THEMES.items():
        idlist = [i for i in ids.split() if i in rows]
        missing = [i for i in ids.split() if i not in rows]
        if missing:
            raise SystemExit(f"theme '{theme}' names unknown ids {missing}")
        out.append(f"## {sec}. {theme}\n")
        sec += 1
        out.append(INTRO[theme] + "\n")
        if DEC:
            out.append("| ID | We assumed | Depends on | AMPM decided | Status |")
            out.append("|---|---|---|---|---|")
        else:
            out.append("| ID | We assumed | If you decide otherwise | Depends on | Confirm | Your call |")
            out.append("|---|---|---|---|---|---|")
        for rid in idlist:
            label, fname, ref, assumption, otherwise = rows[rid]
            if DEC:
                st = DEC["assumptions"].get(rid, {"status": "stands", "note": "Not addressed."})
                out.append(f"| {rid} | {assumption} | {ref} | {st['note']} | {LABEL[st['status']]} |")
            else:
                out.append(f"| {rid} | {assumption} | {otherwise} | {ref} | ☐ | |")
            placed.add(rid)
            total += 1
        out.append("")
    unplaced = sorted(set(rows) - placed)
    if unplaced:
        raise SystemExit(f"assumptions not placed in any theme: {unplaced}")
    if DEC:
        out.append("## What happens next\n")
        out.append("Changed and dropped lines are being applied to the design documents; partly decided and open lines wait for the items AMPM listed to confirm, recorded in [decision-log.md](../decision-log.md).\n")
    else:
        out.append("## How to return this\n")
        out.append("Mark the sheet, or reply with the ID and your answer (for example \"A-4: we charge a transparent fee, not a margin\"). Each confirmed or changed line is applied to the design documents, and the generated files are rebuilt. Nothing here is implemented until you confirm it.\n")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(out) + "\n", encoding="utf8")
    print(f"{total} assumptions in {len(THEMES)} themes; wrote {OUT.relative_to(DOCS)}")


if __name__ == "__main__":
    build()
