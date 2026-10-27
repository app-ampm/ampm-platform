#!/bin/bash
# Tests for docs/tools/setup_memory.sh: the backfill files only redacted copies of the transcripts
# (CLAUDE.md, "Session memory": never file secrets or tokens), under the same snapshot paths the hooks
# use, one by one so another project's snapshot never lands in wing ampm, mines the memory notes beside
# them, deletes nothing from the palace, and points MemPalace's global hooks at the masked wrapper.
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
    walked = [("", [], [sys.argv[2]])] if os.path.isfile(sys.argv[2]) else os.walk(sys.argv[2])
    for root, _, names in walked if "convos" in sys.argv else []:
        for name in names:
            with open(os.path.join(root, name), "rb") as src, open(os.path.expanduser("~/mined"), "ab") as out:
                out.write(src.read())
STANDIN
} > "$BIN/mempalace"
chmod +x "$BIN/uv" "$BIN/graphify" "$BIN/mempalace"

test_backfill_mines_only_redacted_snapshots() {
  local first second
  mkdir -p "$LIVE" "$WORKTREE" "$REDACTED"; first=$(token A); second=$(token B)
  record "main checkout $first" > "$LIVE/s1.jsonl"; record "worktree $second" > "$WORKTREE/s2.jsonl"
  mkdir -p "$LIVE/memory"; printf -- '- a memory note\n' > "$LIVE/memory/note.md"
  record "another project" > "$REDACTED/other.jsonl"  # the global hooks' snapshot of another project's session
  HOME="$H" bash "$REPO/docs/tools/setup_memory.sh" > "$SCRATCH/out" 2>&1 \
    || { fail "setup_memory.sh exited non-zero: $(tail -3 "$SCRATCH/out")"; return; }
  [ -s "$H/mined" ] || fail "the stand-in miner was given nothing to read"
  grep -q -e "$first" -e "$second" "$H/mined" && fail "the backfill mined a token in clear"
  grep -q -e "mine $LIVE --" -e "mine $WORKTREE --" -e "mine $LIVE/s1" -e "mine $WORKTREE/s2" "$H/mine_args" \
    && fail "the backfill mined the live transcripts: $(cat "$H/mine_args")"
  for s in s1 s2; do
    grep -q "mine $REDACTED/$s.jsonl --mode convos --wing ampm" "$H/mine_args" || fail "snapshot $s.jsonl was not mined"
  done
  grep -q -e "mine $REDACTED --" -e "mine $REDACTED/other.jsonl" "$H/mine_args" \
    && fail "the backfill mined another project's snapshot into wing ampm: $(cat "$H/mine_args")"
  [ -f "$REDACTED/s1.jsonl" ] && [ -f "$REDACTED/s2.jsonl" ] || fail "a snapshot is missing from $REDACTED"
  grep -q "$first" "$LIVE/s1.jsonl" && fail "the live transcript was not masked in place"
  grep -q "mine $LIVE/memory --mode convos --wing ampm" "$H/mine_args" || fail "the memory notes were not mined"
  [ -s "$H/other_calls" ] && fail "the backfill ran a command other than mine: $(cat "$H/other_calls")"
  return 0
}

test_setup_masks_mempalace_global_hooks() {  # the installer runs, against the scratch HOME only
  local settings="$H/.claude/settings.json" stop home
  cmp -s "$H/.mempalace/bin/mempalace_global_hook.sh" "$REPO/docs/tools/mempalace_global_hook.sh" \
    && cmp -s "$H/.mempalace/bin/redact_secrets.py" "$REPO/docs/tools/redact_secrets.py" \
    || fail "setup did not install the wrapper and the redactor into ~/.mempalace/bin"
  stop=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["hooks"]["Stop"][0]["hooks"][0]["command"])' \
    "$settings" 2>/dev/null)
  home=$(python3 -c 'import os,sys; print(os.path.normpath(sys.argv[1]))' "$H")  # TMPDIR may end in a slash
  [ "$stop" = "bash \"$home/.mempalace/bin/mempalace_global_hook.sh\" stop" ] \
    || fail "setup did not point MemPalace's Stop hook at the wrapper: $stop"
  ls "$settings".backup-* >/dev/null 2>&1 || fail "setup rewrote the settings without a backup"
  grep -q "wings split --wing wing_api" "$SCRATCH/out" || fail "no wing_api re-key note for the legacy shell hooks"
}

mkdir -p "$H/.claude"  # MemPalace's own hooks, one of them its older shell hook, as a machine may have them
python3 -c 'import json,sys
h = sys.argv[1]
hook = lambda c: [{"hooks": [{"type": "command", "command": c, "timeout": 60}]}]
print(json.dumps({"hooks": {"Stop": hook(h + "/mempalace/hooks/mempal_save_hook.sh"),
  "PreCompact": hook(h + "/.local/bin/mempalace hook run --hook precompact --harness claude-code")}}, indent=2))' \
  "$H" > "$H/.claude/settings.json"
test_backfill_mines_only_redacted_snapshots
test_setup_masks_mempalace_global_hooks
[ "$FAILURES" -eq 0 ] && echo "setup memory tests passed" || echo "setup memory tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
