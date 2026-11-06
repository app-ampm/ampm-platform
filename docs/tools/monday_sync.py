#!/usr/bin/env python3
"""Push AMPM build-plan progress to the monday.com board.

Reads `Monday:` trailers from a merged PR body (or takes --card/--state on the
command line) and, for each referenced card, sets its Status, stamps the
"Completed on" date when done, and posts a progress update to the card's feed —
so the board's status AND the founder-facing detail both stay current.

Trailer format (one per line, anywhere in the PR description):

    Monday: <card-key> <state> [free-text note]

where <state> is one of:  working | done | progress
Example:

    Monday: kernel done sessions + audit-on-change landed; Sprint 3 complete

Card keys are defined in monday_board_map.json. The API token is read from the
MONDAY_API_TOKEN environment variable and is never written to the repo.

Usage:
    MONDAY_API_TOKEN=... python3 docs/tools/monday_sync.py --card kernel --state done --note "..."
    cat pr-body.txt | MONDAY_API_TOKEN=... python3 docs/tools/monday_sync.py --from-pr
    echo "Monday: kernel done x" | python3 docs/tools/monday_sync.py --from-pr --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_URL = "https://api.monday.com/v2"
IST = timezone(timedelta(hours=5, minutes=30))
MAP_PATH = Path(__file__).with_name("monday_board_map.json")

STATE_LABEL = {"working": "Working on it", "done": "Done"}
STATE_EMOJI = {"working": "\U0001f535", "done": "✅", "progress": "\U0001f4dd"}

TRAILER = re.compile(
    r"^\s*Monday:\s*([\w-]+)\s+(working|done|progress)\b[ \t]*(.*)$",
    re.IGNORECASE | re.MULTILINE,
)

SET_COLS = (
    "mutation ($board: ID!, $item: ID!, $vals: JSON!) {"
    "  change_multiple_column_values(board_id: $board, item_id: $item,"
    "    column_values: $vals, create_labels_if_missing: false) { id }"
    "}"
)
POST_UPDATE = (
    "mutation ($item: ID!, $body: String!) {"
    "  create_update(item_id: $item, body: $body) { id }"
    "}"
)


def load_map() -> dict:
    return json.loads(MAP_PATH.read_text())


def gql(token: str, query: str, variables: dict) -> dict:
    payload = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Authorization": token, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode())
    if body.get("errors"):
        raise RuntimeError(json.dumps(body["errors"]))
    return body["data"]


def build_update_body(state: str, note: str, pr: dict, now_ist: datetime) -> str:
    head = f'{STATE_EMOJI.get(state, "")} <b>{STATE_LABEL.get(state, "Progress")}</b>'
    if note:
        head += f" — {note}"
    meta = []
    if pr.get("title"):
        meta.append(pr["title"])
    if pr.get("url"):
        label = f'PR #{pr["number"]}' if pr.get("number") else "PR"
        meta.append(f'<a href="{pr["url"]}">{label}</a>')
    meta.append(now_ist.strftime("%d %b %Y %H:%M IST"))
    return head + "<br>" + " · ".join(meta)


def sync_card(cfg, token, key, state, note, pr, dry_run) -> bool:
    cards = cfg["cards"]
    if key not in cards:
        print(f"  !! unknown card key {key!r} (skipped)", file=sys.stderr)
        return False
    item, board = str(cards[key]), str(cfg["board_id"])
    # monday stores a date column's time as UTC and shows it in the viewer's
    # profile timezone, so write the real UTC instant (not the IST wall clock)
    # and render the human-readable note in IST.
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST)

    vals: dict = {}
    if state in STATE_LABEL:
        vals[cfg["columns"]["status"]] = {"label": STATE_LABEL[state]}
    if state == "done":
        vals[cfg["columns"]["completed"]] = {
            "date": now_utc.strftime("%Y-%m-%d"),
            "time": now_utc.strftime("%H:%M:%S"),
        }
    body = build_update_body(state, note, pr, now_ist)

    if dry_run:
        print(f"  [dry-run] {key} ({item}) state={state}")
        if vals:
            print(f"            columns: {json.dumps(vals)}")
        print(f"            update : {body}")
        return True

    # The status/date write and the progress note are posted independently so a
    # failure of one can never swallow the other. (On 2 Nov 2026 a transient
    # monday 403 USER_UNAUTHORIZED on change_multiple_column_values discarded
    # nine progress notes: both calls shared one try/except, so the note was
    # skipped the moment the column write threw.) The note is the founder-facing
    # record and always gets its own attempt; a dropped status flip is harmless
    # because a later trailer re-applies it.
    col_ok = True
    if vals:
        try:
            gql(token, SET_COLS, {"board": board, "item": item, "vals": json.dumps(vals)})
        except (urllib.error.URLError, RuntimeError, KeyError) as exc:
            col_ok = False
            print(f"  !! monday error on {key} status: {exc}", file=sys.stderr)

    upd_ok = True
    try:
        gql(token, POST_UPDATE, {"item": item, "body": body})
    except (urllib.error.URLError, RuntimeError, KeyError) as exc:
        upd_ok = False
        print(f"  !! monday error on {key} update: {exc}", file=sys.stderr)

    if col_ok and upd_ok:
        print(f"  ok: {key} -> {state}")
    elif upd_ok:
        print(f"  ~~ {key}: note posted; status write failed (a later trailer re-applies it)", file=sys.stderr)
    else:
        print(f"  !! {key}: note post failed" + ("" if col_ok else "; status write also failed"), file=sys.stderr)
    return col_ok and upd_ok


def main() -> None:
    ap = argparse.ArgumentParser(description="Sync AMPM progress to the monday board.")
    ap.add_argument("--from-pr", action="store_true", help="parse Monday: trailers from a PR body on stdin")
    ap.add_argument("--card", help="card key from monday_board_map.json")
    ap.add_argument("--state", choices=["working", "done", "progress"])
    ap.add_argument("--note", default="")
    ap.add_argument("--dry-run", action="store_true", help="print what would be sent; no API calls, no token needed")
    args = ap.parse_args()

    cfg = load_map()
    token = os.environ.get("MONDAY_API_TOKEN", "")
    if not token and not args.dry_run:
        # Post-merge convenience, not a gate: never fail the workflow over this.
        print("MONDAY_API_TOKEN not set; skipping board sync", file=sys.stderr)
        return

    pr = {
        "number": os.environ.get("PR_NUMBER", ""),
        "title": os.environ.get("PR_TITLE", ""),
        "url": os.environ.get("PR_URL", ""),
    }

    jobs = []
    if args.from_pr:
        for m in TRAILER.finditer(sys.stdin.read()):
            jobs.append((m.group(1).lower(), m.group(2).lower(), m.group(3).strip()))
        if not jobs:
            print("no `Monday:` trailers found; nothing to sync")
            return
    elif args.card and args.state:
        jobs.append((args.card.lower(), args.state.lower(), args.note.strip()))
    else:
        ap.error("pass either --from-pr, or --card and --state")

    print(f"monday-sync: {len(jobs)} card(s)")
    failures = 0
    for key, state, note in jobs:
        if not sync_card(cfg, token, key, state, note, pr, args.dry_run):
            failures += 1
    # Only hard-fail on an outright bad key in manual use; in CI stay green.
    if failures and not args.from_pr and not args.dry_run:
        sys.exit(1)


if __name__ == "__main__":
    main()
