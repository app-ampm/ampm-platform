#!/bin/bash
# Tests for docs/tools/setup_memory.sh: the backfill files only redacted copies of the transcripts
# (CLAUDE.md, "Session memory": never file secrets or tokens), under the same snapshot paths the hooks
# use, and drops the drawers an earlier backfill filed under the live paths.
#
#   bash docs/tools/setup_memory_test.sh   # prints "setup memory tests passed", exit 0
#
# Runs with a scratch HOME and stand-ins for uv, graphify and mempalace on PATH (the miner keeps a copy
# of what it was given) and for mempalace.mcp_server on PYTHONPATH. Never touches ~/.mempalace or ~/.claude.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ampm-setup-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
H="$SCRATCH/home"; BIN="$H/.local/bin"; FAILURES=0
mkdir -p "$BIN" "$SCRATCH/pylib/mempalace"
MAIN="$REPO"; case "$MAIN" in */.claude/worktrees/*) MAIN="${MAIN%%/.claude/worktrees/*}" ;; esac
ENC=$(printf '%s' "$MAIN" | sed 's#[/. ]#-#g')
LIVE="$H/.claude/projects/$ENC"; WORKTREE="$H/.claude/projects/$ENC--claude-worktrees-x"
REDACTED="$H/.mempalace/hook_state/redacted"

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
token() { printf 'gh%s_%s' p "$(printf 'Zq%.0s' $(seq 1 18))$1"; }  # assembled at run time
record() { python3 -c 'import json,sys; print(json.dumps({"type": "user", "message": {"content": sys.argv[1]}}))' "$1"; }
real() { python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"; }

printf '#!/bin/bash\necho "stand-in $(basename "$0") $*"\n' > "$BIN/uv"; cp "$BIN/uv" "$BIN/graphify"
{ printf '#!%s\n' "$(command -v python3)"; cat <<'STANDIN'
"""Stand-in for the miner: records each mine and keeps a copy of every conversation file it was given."""
import os, sys
if sys.argv[1:2] == ["mine"]:
    with open(os.path.expanduser("~/mine_args"), "a") as log:
        log.write(" ".join(sys.argv[1:]) + "\n")
    for root, _, names in os.walk(sys.argv[2]) if "convos" in sys.argv else []:
        for name in names:
            with open(os.path.join(root, name), "rb") as src, open(os.path.expanduser("~/mined"), "ab") as out:
                out.write(src.read())
STANDIN
} > "$BIN/mempalace"
chmod +x "$BIN/uv" "$BIN/graphify" "$BIN/mempalace"
: > "$SCRATCH/pylib/mempalace/__init__.py"
cat > "$SCRATCH/pylib/mempalace/mcp_server.py" <<'STANDIN'
"""Stand-in for MemPalace's MCP dispatcher: every snapshot is filed; records each delete-by-source call."""
import json, os

def handle_request(request):
    args = request["params"]["arguments"]
    with open(os.path.expanduser("~/purge_calls"), "a") as log:
        log.write(json.dumps(args) + "\n")
    body = {"success": True, "match_count": 3} if args["dry_run"] else {"success": True, "deleted": 1}
    return {"jsonrpc": "2.0", "id": request["id"], "result": {"content": [{"type": "text", "text": json.dumps(body)}]}}
STANDIN

test_backfill_mines_only_redacted_snapshots() {
  local first second
  mkdir -p "$LIVE" "$WORKTREE"; first=$(token A); second=$(token B)
  record "main checkout $first" > "$LIVE/s1.jsonl"; record "worktree $second" > "$WORKTREE/s2.jsonl"
  HOME="$H" PYTHONPATH="$SCRATCH/pylib" bash "$REPO/docs/tools/setup_memory.sh" > "$SCRATCH/out" 2>&1 \
    || { fail "setup_memory.sh exited non-zero: $(tail -3 "$SCRATCH/out")"; return; }
  grep -q -e "$first" -e "$second" "$H/mined" && fail "the backfill mined a token in clear"
  grep -q "mine $H/.claude" "$H/mine_args" && fail "the backfill mined the live transcripts: $(cat "$H/mine_args")"
  grep -q "mine $REDACTED --mode convos --wing ampm" "$H/mine_args" || fail "the redacted snapshots were not mined"
  [ -f "$REDACTED/s1.jsonl" ] && [ -f "$REDACTED/s2.jsonl" ] || fail "a snapshot is missing from $REDACTED"
  grep -q "$first" "$LIVE/s1.jsonl" && fail "the live transcript was not masked in place"
  grep -q "\"source_file\": \"$(real "$LIVE/s1.jsonl")\", \"dry_run\": false" "$H/purge_calls" 2>/dev/null \
    || fail "the drawers filed under the live path of s1.jsonl were not purged"
}

test_backfill_mines_only_redacted_snapshots
[ "$FAILURES" -eq 0 ] && echo "setup memory tests passed" || echo "setup memory tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
