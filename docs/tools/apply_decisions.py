#!/usr/bin/env python3
"""Apply AMPM's decisions (docs/decisions.json) to the six assumption registers.

For every register row whose ID has an entry in decisions.json, the "Assumption adopted" cell gains a trailing
"AMPM (date): status, note" marker. Running it twice is safe: an existing marker is replaced.
Run: python3 docs/tools/apply_decisions.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
DEC = json.loads((DOCS / "decisions.json").read_text(encoding="utf8"))
DATE = DEC["answered_on"]
FILES = ["data-model.md", "permission-matrix.md", "architecture.md", "user-flows.md", "wireframes.md", "test-cases.md"]
LABEL = {"confirmed": "Confirmed", "changed": "Changed", "partly": "Partly decided", "dropped": "Dropped", "open": "Still open", "stands": "Not addressed, stands"}
ROW = re.compile(r"^(\| ([APTUWV]-\d+) \| [^|]* \| )([^|]*)(\| [^|]* \|)$", re.M)
MARK = re.compile(r"\s*\*\*AMPM \(\d{4}-\d{2}-\d{2}\): [^*]*\*\*\s*$")


def main():
    total = 0
    for f in FILES:
        p = DOCS / f
        s = p.read_text(encoding="utf8")
        n = 0

        def repl(m):
            nonlocal n
            rid = m.group(2)
            d = DEC["assumptions"].get(rid)
            if not d:
                return m.group(0)
            cell = MARK.sub("", m.group(3).rstrip())
            marker = f" **AMPM ({d.get('decided_on', DATE)}): {LABEL[d['status']]}. {d['note']}** "
            n += 1
            return f"{m.group(1)}{cell}{marker}{m.group(4)}"

        s2 = ROW.sub(repl, s)
        if s2 != s:
            p.write_text(s2, encoding="utf8")
        print(f"{f}: {n} rows marked")
        total += n
    missing = sorted(set(DEC["assumptions"]) - {rid for f in FILES for rid in re.findall(r"^\| ([APTUWV]-\d+) \|", (DOCS / f).read_text(encoding="utf8"), re.M)})
    print(f"total {total}; decisions without a register row: {missing or 'none'}")


if __name__ == "__main__":
    main()
