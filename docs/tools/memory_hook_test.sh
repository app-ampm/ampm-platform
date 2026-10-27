#!/bin/bash
# Tests for docs/tools/memory_hook.sh: what the miner reads has been redacted, even while the session
# keeps appending to its transcript (CLAUDE.md, "Session memory": never file secrets or tokens), and
# the drawers an earlier mine filed under the live transcript path are dropped once the snapshot is filed.
#
#   bash docs/tools/memory_hook_test.sh   # prints "memory hook tests passed", exit 0
#
# Runs with a scratch HOME, a stand-in mempalace on PATH that waits, as a real mine does while it
# imports, then copies what it was given, and a stand-in mempalace.mcp_server on PYTHONPATH that records
# delete-by-source calls. Never touches ~/.mempalace, ~/.claude or the real palace.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ampm-hook-test.XXXXXX")"
trap 'chmod -R u+rwx "$SCRATCH" 2>/dev/null; rm -rf "$SCRATCH"' EXIT
H="$SCRATCH/home"; LOG="$H/Library/Logs/ampm-memory-hooks.log"; FAILURES=0
mkdir -p "$H/.local/bin" "$SCRATCH/projects" "$SCRATCH/pylib/mempalace"
PYTHON3="$(command -v python3)"

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
token() { printf 'gh%s_%s' p "$(printf 'Zq%.0s' $(seq 1 18))$1"; }  # assembled at run time
record() { python3 -c 'import json,sys; print(json.dumps({"type": "user", "message": {"content": sys.argv[1]}}))' "$1"; }
mode() { python3 -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777))' "$1" 2>/dev/null; }
real() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"; }

{ printf '#!%s\n' "$PYTHON3"; cat <<'STANDIN'
"""Stand-in for the miner: records its arguments, waits, then keeps a copy of the file it was given."""
import os, shutil, sys, time
if sys.argv[1:2] == ["mine"]:
    with open(os.path.expanduser("~/mine_args"), "a") as log:
        log.write(" ".join(sys.argv[1:]) + "\n")
    time.sleep(1)
    shutil.copy(sys.argv[2], os.path.expanduser("~/mined.jsonl"))
    print("stand-in mined", sys.argv[2])
STANDIN
} > "$H/.local/bin/mempalace"
chmod +x "$H/.local/bin/mempalace"
: > "$SCRATCH/pylib/mempalace/__init__.py"
cat > "$SCRATCH/pylib/mempalace/mcp_server.py" <<'STANDIN'
"""Stand-in for MemPalace's MCP dispatcher: records delete-by-source calls; ~/snapshot_unfiled hides the snapshot."""
import json, os

def handle_request(request):
    args = request["params"]["arguments"]
    with open(os.path.expanduser("~/purge_calls"), "a") as log:
        log.write(json.dumps(args) + "\n")
    filed = 0 if os.path.exists(os.path.expanduser("~/snapshot_unfiled")) else 3
    body = {"success": True, "match_count": filed} if args["dry_run"] else {"success": True, "deleted": 2}
    return {"jsonrpc": "2.0", "id": request["id"], "result": {"content": [{"type": "text", "text": json.dumps(body)}]}}
STANDIN
found=$(HOME="$H" PATH="$H/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" command -v mempalace)
[ "$found" = "$H/.local/bin/mempalace" ] || { echo "the stand-in does not shadow mempalace ($found); not running"; exit 2; }

run_hook() {  # event, transcript path
  printf '{"session_id":"hook-test","transcript_path":"%s"}' "$2" \
    | HOME="$H" CLAUDE_PROJECT_DIR="$REPO" PYTHONPATH="$SCRATCH/pylib" bash "$REPO/docs/tools/memory_hook.sh" "$1" > /dev/null
}
wait_for_log() {  # pattern; up to 20 s for the background mine
  for _ in $(seq 1 100); do grep -q "$1" "$LOG" 2>/dev/null && return 0; sleep 0.2; done; return 1
}
purge_call() {  # source file, dry run (True or False): true when the stand-in dispatcher got that call
  python3 -c 'import json,sys
calls = [json.loads(l) for l in open(sys.argv[1])]
sys.exit(0 if {"source_file": sys.argv[2], "dry_run": sys.argv[3] == "True"} in calls else 1)' "$H/purge_calls" "$1" "$2" 2>/dev/null
}

test_appended_token_is_never_mined() {
  local t="$SCRATCH/projects/t.jsonl" first second snapshot
  first=$(token A); second=$(token B); record "first $first" > "$t"
  run_hook session-end "$t"
  sleep 0.3; record "next turn $second" >> "$t"  # the session keeps writing while the mine runs
  wait_for_log "mined t.jsonl into wing ampm" || { fail "no 'mined t.jsonl into wing ampm' in the log"; return; }
  grep -q -e "$first" -e "$second" "$H/mined.jsonl" && fail "the miner read a token in clear"
  grep -q "$first" "$t" && fail "the live transcript was not masked in place"
  snapshot="$H/.mempalace/hook_state/redacted/t.jsonl"
  grep -q " $snapshot " "$H/mine_args" || fail "the miner was not given the redacted snapshot: $(cat "$H/mine_args")"
  [ -f "$snapshot" ] && [ "$(mode "$snapshot")" = 0o600 ] || fail "the snapshot is missing or not 0600"
  [ "$(mode "$(dirname "$snapshot")")" = 0o700 ] || fail "the snapshot directory is not 0700"
}

test_live_path_drawers_are_purged() {  # the drawers mined from the live file before snapshots existed
  local t="$SCRATCH/projects/t.jsonl"
  wait_for_log "t.jsonl: 2 drawer(s) filed under the live path purged" || fail "no purge line for t.jsonl in the log"
  purge_call "$(real "$H/.mempalace/hook_state/redacted/t.jsonl")" True || fail "the snapshot's drawers were not counted first"
  purge_call "$(real "$t")" False || fail "the drawers under the live path were not deleted"
}

test_unfiled_snapshot_keeps_live_drawers() {
  local u="$SCRATCH/projects/u.jsonl"
  record "plain" > "$u"; touch "$H/snapshot_unfiled"
  run_hook precompact "$u"
  wait_for_log "u.jsonl: the snapshot is not filed yet" || fail "no 'not filed yet' line for u.jsonl"
  purge_call "$(real "$u")" False && fail "live-path drawers were deleted although the snapshot was not filed"
  rm -f "$H/snapshot_unfiled"
}

test_failed_redaction_is_not_mined() {
  local t="$SCRATCH/projects/locked.jsonl"
  record "x" > "$t"; chmod 000 "$t"; : > "$H/mine_args"
  run_hook precompact "$t"
  wait_for_log "secret redaction failed for locked.jsonl; not mining" || fail "no 'not mining' line for an unreadable file"
  sleep 1.5; [ -s "$H/mine_args" ] && fail "a transcript whose redaction failed was mined"
}

test_appended_token_is_never_mined
test_live_path_drawers_are_purged
test_unfiled_snapshot_keeps_live_drawers
test_failed_redaction_is_not_mined
[ "$FAILURES" -eq 0 ] && echo "memory hook tests passed" || echo "memory hook tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
