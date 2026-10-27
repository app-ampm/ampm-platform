#!/bin/bash
# Tests for docs/tools/memory_hook.sh: what the miner reads has been redacted, even while the session
# keeps appending to its transcript (CLAUDE.md, "Session memory": never file secrets or tokens).
#
#   bash docs/tools/memory_hook_test.sh   # prints "memory hook tests passed", exit 0
#
# Runs with a scratch HOME and a stand-in mempalace on PATH that waits, as a real mine does while it
# imports, then copies what it was given. Never touches ~/.mempalace, ~/.claude or the real palace.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ampm-hook-test.XXXXXX")"
trap 'chmod -R u+rwx "$SCRATCH" 2>/dev/null; rm -rf "$SCRATCH"' EXIT
H="$SCRATCH/home"; LOG="$H/Library/Logs/ampm-memory-hooks.log"; FAILURES=0
mkdir -p "$H/.local/bin" "$SCRATCH/projects"

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
token() { printf 'gh%s_%s' p "$(printf 'Zq%.0s' $(seq 1 18))$1"; }  # assembled at run time
record() { python3 -c 'import json,sys; print(json.dumps({"type": "user", "message": {"content": sys.argv[1]}}))' "$1"; }
mode() { python3 -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777))' "$1" 2>/dev/null; }

cat > "$H/.local/bin/mempalace" <<'STANDIN'
#!/bin/bash
# Stand-in for the miner: records its arguments, waits, then keeps a copy of the file it was given.
if [ "$1" = mine ]; then
  printf '%s\n' "$*" >> "$HOME/mine_args"; sleep 1; cp "$2" "$HOME/mined.jsonl"; echo "stand-in mined $2"
fi
STANDIN
chmod +x "$H/.local/bin/mempalace"
found=$(HOME="$H" PATH="$H/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" command -v mempalace)
[ "$found" = "$H/.local/bin/mempalace" ] || { echo "the stand-in does not shadow mempalace ($found); not running"; exit 2; }

run_hook() {  # event, transcript path
  printf '{"session_id":"hook-test","transcript_path":"%s"}' "$2" \
    | HOME="$H" CLAUDE_PROJECT_DIR="$REPO" bash "$REPO/docs/tools/memory_hook.sh" "$1" > /dev/null
}
wait_for_log() {  # pattern; up to 20 s for the background mine
  for _ in $(seq 1 100); do grep -q "$1" "$LOG" 2>/dev/null && return 0; sleep 0.2; done; return 1
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

test_failed_redaction_is_not_mined() {
  local t="$SCRATCH/projects/locked.jsonl"
  record "x" > "$t"; chmod 000 "$t"; : > "$H/mine_args"
  run_hook precompact "$t"
  wait_for_log "secret redaction failed for locked.jsonl; not mining" || fail "no 'not mining' line for an unreadable file"
  sleep 1.5; [ -s "$H/mine_args" ] && fail "a transcript whose redaction failed was mined"
}

test_appended_token_is_never_mined
test_failed_redaction_is_not_mined
[ "$FAILURES" -eq 0 ] && echo "memory hook tests passed" || echo "memory hook tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
