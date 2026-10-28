#!/bin/bash
# Tests for docs/tools/checkpoint.sh: a push the remote refuses is reported to the session, not only logged, and
# commits left unpushed by an earlier turn are pushed by the next checkpoint (on 27 October 2026 the main checkout's
# main had split from origin/main and six hours of refused pushes went unnoticed).
#
#   bash docs/tools/checkpoint_test.sh   # prints "checkpoint tests passed", exit 0
#
# Runs in scratch repositories with a scratch HOME and a bare remote, and a stand-in vault_sync.py; never touches the
# project's repository, its remote, the vault or the real logs.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ampm-checkpoint-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
export HOME="$SCRATCH/home" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
mkdir -p "$HOME/.local/bin"
# checkpoint.sh puts $HOME/.local/bin first on PATH; this stand-in keeps the real miner from filing the scratch docs
printf '#!/bin/bash\nexit 0\n' > "$HOME/.local/bin/mempalace"; chmod +x "$HOME/.local/bin/mempalace"
FAILURES=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
identity() { git -C "$1" config user.name "Checkpoint Test"; git -C "$1" config user.email "test@example.invalid"; }

setup() {  # name: a bare remote and a clone of it with checkpoint.sh, a stand-in vault_sync.py and one pushed commit
  local d="$SCRATCH/$1"
  git init -q --bare -b main "$d/remote.git"
  git init -q -b main "$d/work"; identity "$d/work"
  mkdir -p "$d/work/docs/tools"
  cp "$REPO/docs/tools/checkpoint.sh" "$d/work/docs/tools/"
  printf 'print("vault: stand-in")\n' > "$d/work/docs/tools/vault_sync.py"
  echo one > "$d/work/a.txt"
  git -C "$d/work" add -A; git -C "$d/work" commit -q -m "chore: start"
  git -C "$d/work" remote add origin "$d/remote.git"; git -C "$d/work" push -q -u origin main
  echo "$d"
}
diverge() {  # dir: the remote gets a commit the work clone does not have, as when another checkout pushed
  git clone -q "$1/remote.git" "$1/other"; identity "$1/other"
  echo other > "$1/other/b.txt"; git -C "$1/other" add -A; git -C "$1/other" commit -q -m "chore: elsewhere"
  git -C "$1/other" push -q
}
hook() { printf '{}' | bash "$1/work/docs/tools/checkpoint.sh" --hook; }
unpushed() { git -C "$1/work" rev-list --count origin/main..main; }

test_refused_push_is_reported() {
  local d out; d=$(setup refused); diverge "$d"
  echo two >> "$d/work/a.txt"; out=$(hook "$d")
  printf '%s' "$out" | python3 -c 'import json,sys; json.loads(sys.stdin.read())' 2>/dev/null \
    || fail "the hook output is not one JSON object: $out"
  printf '%s' "$out" | grep -q "push to origin failed" || fail "a refused push was not reported: $out"
  printf '%s' "$out" | grep -q "vault synced" && fail "a refused push was reported as a plain checkpoint: $out"
  return 0
}

test_unpushed_commits_are_reported_on_a_quiet_turn() {
  local d out; d=$(setup quiet); diverge "$d"
  echo two >> "$d/work/a.txt"; hook "$d" > /dev/null
  out=$(hook "$d")  # nothing left to commit, but the earlier commit is still not on origin
  printf '%s' "$out" | grep -q "push to origin failed" || fail "unpushed commits went unreported on a quiet turn: '$out'"
  printf '%s' "$out" | grep -q "1 commit" || fail "the report does not count the unpushed commits: '$out'"
}

test_unpushed_commits_are_pushed_once_the_remote_accepts() {
  local d out; d=$(setup retry)
  echo two >> "$d/work/a.txt"; git -C "$d/work" commit -q -am "chore: left unpushed"
  out=$(hook "$d")
  [ "$(unpushed "$d")" = 0 ] || fail "the next checkpoint did not push the commit an earlier turn left unpushed"
  [ -z "$out" ] || fail "a quiet turn whose push went through printed: $out"
}

test_ordinary_checkpoint_is_unchanged() {
  local d out; d=$(setup plain)
  echo two >> "$d/work/a.txt"; out=$(hook "$d")
  printf '%s' "$out" | grep -q '"systemMessage": "AMPM checkpoint: chore: checkpoint .*; vault synced"' \
    || fail "an ordinary checkpoint message changed: $out"
  [ "$(unpushed "$d")" = 0 ] || fail "an ordinary checkpoint was not pushed"
  out=$(hook "$d"); [ -z "$out" ] || fail "a turn with nothing to do printed: $out"
}

test_refused_push_is_reported
test_unpushed_commits_are_reported_on_a_quiet_turn
test_unpushed_commits_are_pushed_once_the_remote_accepts
test_ordinary_checkpoint_is_unchanged
[ "$FAILURES" -eq 0 ] && echo "checkpoint tests passed" || echo "checkpoint tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
