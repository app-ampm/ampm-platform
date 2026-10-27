#!/bin/bash
# Tests for docs/tools/setup_memory.sh: the backfill files only redacted copies of the transcripts
# (CLAUDE.md, "Session memory": never file secrets or tokens), under the same snapshot paths the hooks
# use, mines the memory notes beside them, and deletes nothing from the palace.
#
#   bash docs/tools/setup_memory_test.sh   # prints "setup memory tests passed", exit 0
#
# Runs with a scratch HOME and stand-ins for uv, graphify and mempalace on PATH (the miner keeps a copy
# of what it was given). Never touches ~/.mempalace or ~/.claude.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ampm-setup-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
H="$SCRATCH/home"; BIN="$H/.local/bin"; FAILURES=0
mkdir -p "$BIN"
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
if sys.argv[1:2] not in (["mine"], ["--version"]):
    with open(os.path.expanduser("~/other_calls"), "a") as log:
        log.write(" ".join(sys.argv[1:]) + "\n")
elif sys.argv[1:2] == ["mine"]:
    with open(os.path.expanduser("~/mine_args"), "a") as log:
        log.write(" ".join(sys.argv[1:]) + "\n")
    for root, _, names in os.walk(sys.argv[2]) if "convos" in sys.argv else []:
        for name in names:
            with open(os.path.join(root, name), "rb") as src, open(os.path.expanduser("~/mined"), "ab") as out:
                out.write(src.read())
STANDIN
} > "$BIN/mempalace"
chmod +x "$BIN/uv" "$BIN/graphify" "$BIN/mempalace"

test_backfill_mines_only_redacted_snapshots() {
  local first second
  mkdir -p "$LIVE" "$WORKTREE"; first=$(token A); second=$(token B)
  record "main checkout $first" > "$LIVE/s1.jsonl"; record "worktree $second" > "$WORKTREE/s2.jsonl"
  mkdir -p "$LIVE/memory"; printf -- '- a memory note\n' > "$LIVE/memory/note.md"
  HOME="$H" bash "$REPO/docs/tools/setup_memory.sh" > "$SCRATCH/out" 2>&1 \
    || { fail "setup_memory.sh exited non-zero: $(tail -3 "$SCRATCH/out")"; return; }
  grep -q -e "$first" -e "$second" "$H/mined" && fail "the backfill mined a token in clear"
  grep -q -e "mine $LIVE --" -e "mine $WORKTREE --" -e "mine $LIVE/s1" -e "mine $WORKTREE/s2" "$H/mine_args" \
    && fail "the backfill mined the live transcripts: $(cat "$H/mine_args")"
  grep -q "mine $REDACTED --mode convos --wing ampm" "$H/mine_args" || fail "the redacted snapshots were not mined"
  [ -f "$REDACTED/s1.jsonl" ] && [ -f "$REDACTED/s2.jsonl" ] || fail "a snapshot is missing from $REDACTED"
  grep -q "$first" "$LIVE/s1.jsonl" && fail "the live transcript was not masked in place"
  grep -q "mine $LIVE/memory --mode convos --wing ampm" "$H/mine_args" || fail "the memory notes were not mined"
  [ -s "$H/other_calls" ] && fail "the backfill ran a command other than mine: $(cat "$H/other_calls")"
  return 0
}

test_backfill_mines_only_redacted_snapshots
[ "$FAILURES" -eq 0 ] && echo "setup memory tests passed" || echo "setup memory tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
