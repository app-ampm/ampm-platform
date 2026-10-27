#!/usr/bin/env python3
"""Tests for purge_live_drawers.py, with a stand-in for MemPalace's MCP dispatcher.

The drawers filed under a live transcript path go once the redacted snapshot is filed, and only then
(CLAUDE.md, "Session memory": never file secrets or tokens; the live-path drawers predate the snapshot).

    python3 docs/tools/purge_live_drawers_test.py   # prints "purge tests passed" or each failure
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import purge_live_drawers as purge  # noqa: E402

LIVE, SNAPSHOT = "/nonexistent/projects/s.jsonl", "/nonexistent/redacted/s.jsonl"


class Dispatcher:
    """Answers delete-by-source like MemPalace: filed is the snapshot's drawer count, body overrides a reply."""

    def __init__(self, filed: int, body: dict[str, Any] | None = None) -> None:
        self.filed, self.body, self.calls = filed, body, []

    def __call__(self, request: dict[str, Any]) -> dict[str, Any]:
        arguments = request["params"]["arguments"]
        self.calls.append((arguments["source_file"], arguments["dry_run"]))
        body = self.body or ({"success": True, "match_count": self.filed} if arguments["dry_run"] else
                             {"success": True, "deleted": 2})
        return {"result": {"content": [{"type": "text", "text": json.dumps(body)}]}}


def quiet_run(handle: Dispatcher, argv: list[str]) -> tuple[int, str]:
    """purge.run with its output captured."""
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        status = purge.run(handle, argv)
    return status, out.getvalue()


def cases() -> list[str]:
    """Problems found; empty when every case behaves."""
    problems = []
    filed = Dispatcher(filed=3)
    status, out = quiet_run(filed, [LIVE, SNAPSHOT])
    if status != 0 or filed.calls != [(SNAPSHOT, True), (LIVE, False)] or "2 drawer(s)" not in out:
        problems.append(f"filed snapshot: expected a count then a delete, got {filed.calls} / {status}")
    unfiled = Dispatcher(filed=0)
    status, out = quiet_run(unfiled, [LIVE, SNAPSHOT])
    if status != 0 or (LIVE, False) in unfiled.calls or "not filed yet" not in out:
        problems.append(f"unfiled snapshot: the live-path drawers were deleted ({unfiled.calls})")
    refused = Dispatcher(filed=3, body={"error": "another mempalace writer already holds the palace lock"})
    status, out = quiet_run(refused, [LIVE, SNAPSHOT])
    if status != 1 or (LIVE, False) in refused.calls or "purge failed" not in out:
        problems.append(f"refused: expected exit 1 and no delete, got {status} / {refused.calls}")
    same = Dispatcher(filed=3)
    status, _ = quiet_run(same, [SNAPSHOT, SNAPSHOT])
    if status != 1 or same.calls:
        problems.append("same file: a snapshot was purged as its own live path")
    if quiet_run(Dispatcher(filed=3), [LIVE])[0] != 2:
        problems.append("usage: an odd number of paths was accepted")
    return problems


def run() -> int:
    """Runs every case; prints each failure and returns 1 when any failed."""
    problems = cases()
    for problem in problems:
        print(f"FAIL: {problem}")
    print("purge tests passed" if not problems else f"purge tests: {len(problems)} failure(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(run())
