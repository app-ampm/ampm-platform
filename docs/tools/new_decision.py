#!/usr/bin/env python3
"""Create the next build decision record in the vault (notes/Build decisions/D-nnn Title.md).

    python3 docs/tools/new_decision.py "Title" --area tooling --status accepted --relates T-1,A-3

Areas: data-model, permissions, architecture, flows, screens, tests, tooling, process.
Status: proposed, accepted, superseded. The note links to the current session's journal note when one is open.
Prints the path; fill in Context, Decision, Alternatives considered and Consequences, then let the next checkpoint commit it.
"""
from __future__ import annotations

import argparse
import datetime
import os
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
VAULT = Path(os.environ.get("AMPM_VAULT", PROJECT / "vault"))
FOLDER = VAULT / "notes" / "Build decisions"
POINTER = VAULT / ".current-session"


def next_id():
    nums = [int(m.group(1)) for p in FOLDER.glob("D-*.md") for m in [re.match(r"D-(\d+)", p.name)] if m]
    return max(nums, default=0) + 1


def current_session():
    if POINTER.exists():
        name = Path(POINTER.read_text().strip()).stem
        if name:
            return f"[[{name}]]"
    return ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("title")
    ap.add_argument("--area", default="process")
    ap.add_argument("--status", default="accepted", choices=["proposed", "accepted", "superseded"])
    ap.add_argument("--relates", default="", help="comma-separated ids, e.g. T-1,A-3,Q7")
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    a = ap.parse_args()
    FOLDER.mkdir(parents=True, exist_ok=True)
    did = f"D-{next_id():03d}"
    safe = re.sub(r'[\\/:*?"<>|#^\[\]]+', " ", a.title).strip()
    relates = [r.strip() for r in a.relates.split(",") if r.strip()]
    sess = current_session()
    text = f'''---
type: build-decision
id: {did}
title: "{a.title}"
date: {a.date}
status: {a.status}
area: {a.area}
relates: [{", ".join(relates)}]
supersedes: ""
session: "{sess}"
tags: [ampm, build-decision, area/{a.area}, status/{a.status}]
---
# {did} {a.title}

## Context

## Decision

## Alternatives considered

## Consequences

## Links
- Session: {sess or "(none)"}
- Related: {", ".join(f"[[{r}]]" for r in relates) or "(none)"}
'''
    path = FOLDER / f"{did} {safe}.md"
    path.write_text(text, encoding="utf8")
    print(path)


if __name__ == "__main__":
    main()
