#!/usr/bin/env python3
"""Drops the drawers MemPalace filed under a live transcript path once its redacted snapshot is filed.

    <mempalace's python> docs/tools/purge_live_drawers.py LIVE SNAPSHOT [LIVE SNAPSHOT ...]
        prints "<name>: N drawer(s) filed under the live path purged" per pair; exit 1 when one failed

Run with the miner's own interpreter (the shebang of the mempalace command) by memory_hook.sh after
each mine and by setup_memory.sh after the backfill. Before the hooks mined a redacted snapshot they
mined the live file, and MemPalace keys a session's drawers by that path: the old drawers, some filed
by a weaker redactor, were then never refreshed and doubled the snapshot's. The live-path drawers go
only when the snapshot already has drawers, through MemPalace's own delete-by-source tool, which
takes the palace's writer lock and refuses while another writer holds it.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Callable

Handler = Callable[[dict[str, Any]], Any]  # mempalace.mcp_server.handle_request


class PurgeError(Exception):
    """A purge MemPalace refused or failed; the live-path drawers stay until the next mine."""


def delete_by_source(handle: Handler, source_file: str, dry_run: bool) -> dict[str, Any]:
    """Calls mempalace_delete_by_source through the MCP dispatcher and returns its JSON result.

    delete_by_source(handle_request, "/abs/t.jsonl", True)  # {"success": True, "match_count": 3, ...}
    """
    arguments = {"source_file": source_file, "dry_run": dry_run}
    request = {"jsonrpc": "2.0", "id": 1, "method": "tools/call"}
    request["params"] = {"name": "mempalace_delete_by_source", "arguments": arguments}
    reply = handle(request)
    try:
        body = json.loads(reply["result"]["content"][0]["text"])
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise PurgeError(f"unexpected reply from MemPalace ({type(error).__name__})") from error
    if not isinstance(body, dict) or body.get("success") is not True:
        detail = body.get("error", "refused") if isinstance(body, dict) else "refused"
        raise PurgeError(str(detail))
    return body


def purge(handle: Handler, live: str, snapshot: str) -> str:
    """Deletes the drawers filed under live when snapshot has drawers; returns what happened.

    purge(handle_request, "~/.claude/projects/p/s.jsonl", "~/.mempalace/hook_state/redacted/s.jsonl")
    """
    live, snapshot = os.path.realpath(live), os.path.realpath(snapshot)  # MemPalace stores resolved paths
    if live == snapshot:
        raise PurgeError("the live path and the snapshot are the same file")
    if not delete_by_source(handle, snapshot, dry_run=True).get("match_count"):
        return "the snapshot is not filed yet; the live-path drawers stay"
    deleted = delete_by_source(handle, live, dry_run=False).get("deleted", 0)
    return f"{deleted} drawer(s) filed under the live path purged"


def run(handle: Handler, argv: list[str]) -> int:
    """Purges each LIVE SNAPSHOT pair in argv; prints one line per pair; 1 when any failed, 2 on usage.

    run(handle_request, ["live/s.jsonl", "redacted/s.jsonl"])  # 0, prints "s.jsonl: 2 drawer(s) ..."
    """
    if not argv or len(argv) % 2:
        print(__doc__.strip())
        return 2
    status = 0
    for live, snapshot in zip(argv[::2], argv[1::2]):
        try:
            outcome = purge(handle, live, snapshot)
        except PurgeError as error:
            outcome, status = f"purge failed ({error}); the live-path drawers stay", 1
        print(f"{os.path.basename(live)}: {outcome}", flush=True)
    return status


def main(argv: list[str]) -> int:
    """The command line in the module docstring, with MemPalace's dispatcher; 1 when MemPalace is missing.

    main(["live/s.jsonl", "redacted/s.jsonl"])
    """
    try:
        from mempalace.mcp_server import handle_request
    except ImportError as error:
        print(f"purge skipped: MemPalace is not importable here ({error.name})")
        return 1
    return run(handle_request, argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
