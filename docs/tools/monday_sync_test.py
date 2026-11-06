#!/usr/bin/env python3
"""Tests for monday_sync.py — the board sync's post-merge card update.

The regression under guard: on 2 Nov 2026 a transient monday 403
USER_UNAUTHORIZED on change_multiple_column_values discarded nine hotels
progress notes, because sync_card set the status column and posted the note in
one shared try/except — the note was skipped the moment the column write threw.
The fix posts the two independently, so the founder-facing note always lands
even when the status write fails (a later trailer re-applies the status).

    python3 docs/tools/monday_sync_test.py   # prints "self-test passed", exit 0
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monday_sync as ms  # noqa: E402

CFG = {
    "board_id": 5032167934,
    "columns": {"status": "color_status", "completed": "date_done"},
    "cards": {"hotels": 2892628238},
}
PR = {
    "number": "37",
    "title": "feat(hotels): staff hotel catalogue + spreadsheet import",
    "url": "https://github.com/app-ampm/ampm-platform/pull/37",
}


class FakeGql:
    """Stand-in for ms.gql that records every call and can fail one mutation."""

    def __init__(self, fail_on: str | None = None):
        self.calls: list[tuple[str, dict]] = []
        self.fail_on = fail_on

    def __call__(self, token, query, variables):
        self.calls.append((query, variables))
        if self.fail_on is not None and query == self.fail_on:
            raise RuntimeError(
                '[{"message": "User unauthorized to perform action", '
                '"extensions": {"code": "USER_UNAUTHORIZED", "status_code": 403}}]'
            )
        return {"ok": {"id": "1"}}


@contextlib.contextmanager
def patched(fail_on: str | None = None):
    """Run sync_card with ms.gql replaced; yields (fake, stdout, stderr)."""
    fake = FakeGql(fail_on)
    original, out, err = ms.gql, io.StringIO(), io.StringIO()
    ms.gql = fake
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            yield fake, out, err
    finally:
        ms.gql = original


def ops(fake: FakeGql) -> list[str]:
    return [q for q, _ in fake.calls]


def update_body(fake: FakeGql) -> str | None:
    return next((v["body"] for q, v in fake.calls if q == ms.POST_UPDATE), None)


def status_vals(fake: FakeGql) -> dict:
    v = next((v for q, v in fake.calls if q == ms.SET_COLS), None)
    return json.loads(v["vals"]) if v else {}


def check_status_failure_keeps_note() -> list[str]:
    """The regression: a 403 on the status write must not drop the progress note."""
    with patched(fail_on=ms.SET_COLS) as (fake, _out, _err):
        ret = ms.sync_card(CFG, "tok", "hotels", "working", "slice 1", PR, dry_run=False)
    problems = []
    if ms.SET_COLS not in ops(fake):
        problems.append("status write was never attempted")
    if ms.POST_UPDATE not in ops(fake):
        problems.append("note post was skipped after the status write failed (the 2 Nov bug)")
    body = update_body(fake)
    if body is None or "PR #37" not in body or "Working on it" not in body:
        problems.append("note body missing or malformed")
    if ret is not False:
        problems.append(f"expected partial-failure return False, got {ret!r}")
    return [f"status_failure_keeps_note: {p}" for p in problems]


def check_both_succeed() -> list[str]:
    with patched() as (fake, out, _err):
        ret = ms.sync_card(CFG, "tok", "hotels", "working", "slice 1", PR, dry_run=False)
    problems = []
    if ops(fake) != [ms.SET_COLS, ms.POST_UPDATE]:
        problems.append(f"expected status then update, got {len(ops(fake))} call(s)")
    if ret is not True:
        problems.append(f"expected True, got {ret!r}")
    if "ok: hotels -> working" not in out.getvalue():
        problems.append("missing 'ok' log line")
    return [f"both_succeed: {p}" for p in problems]


def check_progress_skips_status() -> list[str]:
    """A 'progress' trailer sets no column, so it must never call the status write."""
    with patched() as (fake, _out, _err):
        ret = ms.sync_card(CFG, "tok", "hotels", "progress", "fyi", PR, dry_run=False)
    problems = []
    if ms.SET_COLS in ops(fake):
        problems.append("progress should not write any column")
    if ms.POST_UPDATE not in ops(fake):
        problems.append("progress note was not posted")
    if ret is not True:
        problems.append(f"expected True, got {ret!r}")
    return [f"progress_skips_status: {p}" for p in problems]


def check_note_failure_returns_false() -> list[str]:
    with patched(fail_on=ms.POST_UPDATE) as (fake, _out, _err):
        ret = ms.sync_card(CFG, "tok", "hotels", "working", "slice 1", PR, dry_run=False)
    problems = []
    if ms.SET_COLS not in ops(fake) or ms.POST_UPDATE not in ops(fake):
        problems.append("both calls should still be attempted")
    if ret is not False:
        problems.append(f"expected False when the note fails, got {ret!r}")
    return [f"note_failure_returns_false: {p}" for p in problems]


def check_done_stamps_date() -> list[str]:
    with patched() as (fake, _out, _err):
        ret = ms.sync_card(CFG, "tok", "hotels", "done", "complete", PR, dry_run=False)
    vals = status_vals(fake)
    problems = []
    if CFG["columns"]["status"] not in vals:
        problems.append("done did not set the status column")
    if CFG["columns"]["completed"] not in vals:
        problems.append("done did not stamp the completion date")
    if ret is not True:
        problems.append(f"expected True, got {ret!r}")
    return [f"done_stamps_date: {p}" for p in problems]


def check_unknown_key_skipped() -> list[str]:
    with patched() as (fake, _out, _err):
        ret = ms.sync_card(CFG, "tok", "nope", "working", "", PR, dry_run=False)
    problems = []
    if ops(fake):
        problems.append("an unknown card key should hit no API")
    if ret is not False:
        problems.append(f"expected False for unknown key, got {ret!r}")
    return [f"unknown_key_skipped: {p}" for p in problems]


def check_trailer_parsing() -> list[str]:
    """The regex pulls (key, state, note) from each trailer and ignores other lines."""
    body = (
        "Some description.\n"
        "Monday: hotels working slice 1\n"
        "not a trailer: hotels done x\n"
        "Monday: kernel done sprint 5 finished\n"
        "monday: vps progress \n"  # lower-case keyword, empty note
    )
    got = [(m.group(1).lower(), m.group(2).lower(), m.group(3).strip()) for m in ms.TRAILER.finditer(body)]
    want = [("hotels", "working", "slice 1"), ("kernel", "done", "sprint 5 finished"), ("vps", "progress", "")]
    return [] if got == want else [f"trailer_parsing: expected {want}, got {got}"]


LOG_CFG = {
    "pr_log": {
        "board_id": 999,
        "columns": {
            "pr_number": "n", "merged": "d", "type": "t", "area": "a", "author": "au",
            "link": "l", "what": "w", "how": "h", "why": "y",
        },
    }
}


def check_parse_pr_body_sections() -> list[str]:
    """type/area from a conventional title; What/How/Why from named markdown sections."""
    body = "intro\n\n## What\nAdded rate cards.\n\n## How\nNew tables + API.\n\n## Why it matters\nThe paid product.\n"
    ptype, area, what, how, why = ms.parse_pr_body("feat(hotels): rate cards", body)
    problems = []
    if (ptype, area) != ("feat", "hotels"):
        problems.append(f"type/area = {(ptype, area)!r}")
    if "Added rate cards" not in what:
        problems.append(f"what = {what!r}")
    if "New tables" not in how:
        problems.append(f"how = {how!r}")
    if "paid product" not in why.lower():
        problems.append(f"why = {why!r}")
    return [f"parse_sections: {p}" for p in problems]


def check_parse_pr_body_fallback() -> list[str]:
    """A prose title has no type; with no sections, what is the first paragraph."""
    ptype, area, what, how, why = ms.parse_pr_body(
        "Hardening pass after the audit", "First real paragraph.\n\nSecond paragraph.\n"
    )
    problems = []
    if ptype or area:
        problems.append(f"prose title should yield no type/area, got {(ptype, area)!r}")
    if not what.startswith("First real paragraph"):
        problems.append(f"what fallback = {what!r}")
    if how or why:
        problems.append("how/why should be blank with no sections")
    return [f"parse_fallback: {p}" for p in problems]


def check_log_pr_creates_row() -> list[str]:
    """log_pr posts one create_item with the board id, a '#NN ' name, and mapped columns."""
    pr = {"number": "42", "title": "feat(api): a thing", "url": "https://gh/pull/42",
          "author": "app-ampm", "merged": "2026-11-02T07:11:38Z"}
    with patched() as (fake, _out, _err):
        ret = ms.log_pr(LOG_CFG, "tok", pr, "## What\nDid a thing.\n", dry_run=False)
    problems = []
    created = [v for q, v in fake.calls if q == ms.CREATE_ITEM]
    if len(created) != 1:
        problems.append(f"expected 1 create_item, got {len(created)}")
    else:
        v = created[0]
        vals = json.loads(v["vals"])
        if v.get("board") != "999":
            problems.append(f"board = {v.get('board')!r}")
        if not v.get("name", "").startswith("#42 "):
            problems.append(f"name = {v.get('name')!r}")
        if vals.get("n") != "42" or vals.get("t") != "feat" or vals.get("a") != "api":
            problems.append(f"number/type/area = {(vals.get('n'), vals.get('t'), vals.get('a'))!r}")
        if vals.get("d", {}).get("date") != "2026-11-02":
            problems.append(f"merged date = {vals.get('d')!r}")
        if vals.get("l", {}).get("url") != "https://gh/pull/42":
            problems.append("link url not set")
        if not vals.get("w", {}).get("text"):
            problems.append("what column empty")
    if ret is not True:
        problems.append(f"expected True, got {ret!r}")
    return [f"log_pr_creates_row: {p}" for p in problems]


def check_log_pr_unconfigured() -> list[str]:
    """With no pr_log section, log_pr is a no-op that hits no API."""
    with patched() as (fake, _out, _err):
        ret = ms.log_pr({"cards": {}}, "tok", {"number": "1", "title": "x"}, "", dry_run=False)
    problems = []
    if any(q == ms.CREATE_ITEM for q, _ in fake.calls):
        problems.append("create_item called though no board is configured")
    if ret is not True:
        problems.append(f"expected True no-op, got {ret!r}")
    return [f"log_pr_unconfigured: {p}" for p in problems]


def run() -> int:
    checks = [
        check_status_failure_keeps_note,
        check_both_succeed,
        check_progress_skips_status,
        check_note_failure_returns_false,
        check_done_stamps_date,
        check_unknown_key_skipped,
        check_trailer_parsing,
        check_parse_pr_body_sections,
        check_parse_pr_body_fallback,
        check_log_pr_creates_row,
        check_log_pr_unconfigured,
    ]
    failures: list[str] = []
    for check in checks:
        failures += check()
    for failure in failures:
        print(f"FAIL: {failure}")
    print("self-test passed" if not failures else f"self-test: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run())
