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

On a merged PR (--from-pr) it also appends one row to the PR-log board — what
shipped, how, and why, parsed from the title and description — whenever a
"pr_log" section is present in monday_board_map.json. PR_AUTHOR and PR_MERGED_AT
(set by the workflow) enrich that row.

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


# ── PR-log board ────────────────────────────────────────────────────────────
# A companion board carries one row per merged PR (what shipped, how, and why),
# where the milestone board above only moves when a whole card is done. The row
# is built from the PR title (conventional-commit type + scope) and description,
# parsed into What/How/Why by markdown headings with a first-paragraph fallback.
# Column ids live under "pr_log" in monday_board_map.json; see monday-sync.md.

CREATE_ITEM = (
    "mutation ($board: ID!, $name: String!, $vals: JSON!) {"
    "  create_item(board_id: $board, item_name: $name, column_values: $vals) { id }"
    "}"
)

CONVENTIONAL = {"feat", "fix", "chore", "docs", "test", "refactor", "perf", "ci", "build", "style", "revert"}
_TYPE = re.compile(r"^\s*(\w+)(?:\(([^)]*)\))?!?:", re.ASCII)
_HEADER = re.compile(r"^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$", re.MULTILINE)
_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)

_WHY_HEADS = ("why", "why it matters", "motivation", "rationale", "context", "background", "problem")
_HOW_HEADS = ("how", "implementation", "the fix", "the change", "changes", "approach", "what i did", "details", "design")
_WHAT_HEADS = ("what", "summary", "overview", "what changed", "what this is", "what was done")
_CAP = {"what": 700, "how": 600, "why": 600}


def _clean_body(body: str) -> str:
    """The PR description without HTML comments, Monday: trailers, or the bot/co-author footers."""
    out = []
    for line in _HTML_COMMENT.sub("", body or "").splitlines():
        s = line.strip()
        if TRAILER.match(line) or s.startswith("🤖") or s.lower().startswith("co-authored-by:"):
            continue
        out.append(line)
    return "\n".join(out).strip()


def _sections(body: str) -> tuple[str, list[tuple[str, str]]]:
    """(text before the first heading, [(heading, section body), …])."""
    heads = list(_HEADER.finditer(body))
    if not heads:
        return body.strip(), []
    preamble = body[: heads[0].start()].strip()
    sections = []
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(body)
        sections.append((m.group(1).strip(), body[m.end():end].strip()))
    return preamble, sections


def _matches(head: str, synonyms: tuple[str, ...]) -> bool:
    h = head.lower().strip(" :—-?.")
    return any(h == s or h.startswith(s + " ") for s in synonyms)


def _collapse(text: str, cap: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= cap else text[: cap - 1].rstrip() + "…"


def parse_pr_body(title: str, body: str) -> tuple[str, str, str, str, str]:
    """(type, area, what, how, why) for a PR, best-effort from its title and description.

    type/area come from a conventional-commit title (`feat(hotels): …`); a prose
    title yields neither. what/how/why come from markdown sections named by their
    heading (What/Summary, How/Implementation, Why/Motivation…); with no such
    section, what falls back to the first paragraph then the title, how/why blank.
    """
    m = _TYPE.match(title or "")
    ptype = m.group(1).lower() if m else ""
    area = (m.group(2).strip() if m and m.group(2) else "")
    if ptype not in CONVENTIONAL:
        ptype = ""

    preamble, sections = _sections(_clean_body(body))
    what = how = why = ""
    for head, content in sections:
        if not why and _matches(head, _WHY_HEADS):
            why = content
        elif not how and _matches(head, _HOW_HEADS):
            how = content
        elif not what and _matches(head, _WHAT_HEADS):
            what = content
    if not what:
        what = next((b.strip() for b in re.split(r"\n\s*\n", preamble) if b.strip()), "") or (title or "")
    return ptype, area, _collapse(what, _CAP["what"]), _collapse(how, _CAP["how"]), _collapse(why, _CAP["why"])


def _merged_date(merged_iso: str) -> dict:
    """monday date value {date,time} in UTC from an ISO instant; now if unparseable."""
    try:
        dt = datetime.fromisoformat((merged_iso or "").replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        dt = datetime.now(timezone.utc)
    return {"date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M:%S")}


def build_log_columns(log_cfg: dict, pr: dict, body: str) -> dict:
    """The PR-log row's column values, keyed by the column ids in monday_board_map.json."""
    cols = log_cfg["columns"]
    number, title, url = pr.get("number", ""), pr.get("title", ""), pr.get("url", "")
    ptype, area, what, how, why = parse_pr_body(title, body)
    return {
        cols["pr_number"]: str(number),
        cols["merged"]: _merged_date(pr.get("merged", "")),
        cols["type"]: ptype,
        cols["area"]: area,
        cols["author"]: pr.get("author", "") or "",
        cols["link"]: {"url": url, "text": f"PR #{number}" if number else "PR"},
        cols["what"]: {"text": what},
        cols["how"]: {"text": how},
        cols["why"]: {"text": why},
    }


def log_pr(cfg: dict, token: str, pr: dict, body: str, dry_run: bool) -> bool:
    """Append one row to the PR-log board for a merged PR (no-op if the board is unconfigured)."""
    log_cfg = cfg.get("pr_log")
    if not log_cfg:
        return True
    number, title = pr.get("number", ""), pr.get("title", "")
    name = ((f"#{number} {title}".strip() if number else title) or f"PR {number}")[:255]
    vals = build_log_columns(log_cfg, pr, body)

    if dry_run:
        print(f"  [dry-run] pr-log {name[:60]}")
        print(f"            columns: {json.dumps(vals)[:300]}…")
        return True
    try:
        gql(token, CREATE_ITEM, {"board": str(log_cfg["board_id"]), "name": name, "vals": json.dumps(vals)})
        print(f"  ok: pr-log #{number}")
        return True
    except (urllib.error.URLError, RuntimeError, KeyError) as exc:
        print(f"  !! monday error on pr-log #{number}: {exc}", file=sys.stderr)
        return False


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
        "author": os.environ.get("PR_AUTHOR", ""),
        "merged": os.environ.get("PR_MERGED_AT", ""),
    }

    body_text, jobs = "", []
    if args.from_pr:
        body_text = sys.stdin.read()
        jobs = [(m.group(1).lower(), m.group(2).lower(), m.group(3).strip()) for m in TRAILER.finditer(body_text)]
    elif args.card and args.state:
        jobs = [(args.card.lower(), args.state.lower(), args.note.strip())]
    else:
        ap.error("pass either --from-pr, or --card and --state")

    # PR-log board: one row per merged PR, whether or not it carries trailers.
    if args.from_pr and cfg.get("pr_log"):
        log_pr(cfg, token, pr, body_text, args.dry_run)

    # Build-plan board: trailer-driven card status + progress notes.
    if not jobs:
        if args.from_pr:
            print("no `Monday:` trailers found; build-plan board unchanged")
        return

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
