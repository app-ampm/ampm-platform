#!/bin/bash
# Tests for .claude/hooks/check-file.sh (lint on write) and .claude/hooks/typecheck.sh (the Stop-hook typecheck): each
# acts on the checkout the session works in. Claude Code runs both from the main checkout, with CLAUDE_PROJECT_DIR and
# the working directory set to it, even when the session edits a worktree under .claude/worktrees/; until 23 November
# 2026 they linted and typechecked the main checkout only, so nothing checked what worktree sessions wrote.
#
#   bash docs/tools/claude_hooks_test.sh   # prints "claude hooks tests passed", exit 0
#
# Runs in a scratch repository with a worktree, a scratch HOME (no nvm) and a stand-in pnpm on PATH that records the
# directory it runs in; never touches the project's checkouts or runs the real ESLint or turbo.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/ampm-claude-hooks-test.XXXXXX")"
SCRATCH="$(cd "$SCRATCH" && pwd -P)"
trap 'rm -rf "$SCRATCH"' EXIT
export HOME="$SCRATCH/home" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
mkdir -p "$HOME" "$SCRATCH/bin"
export PNPM_LOG="$SCRATCH/pnpm.log"
# The stand-in pnpm logs "<directory> <arguments>"; STUB_FAIL=eslint|turbo makes that command fail as a real error would.
cat > "$SCRATCH/bin/pnpm" <<'EOF'
#!/bin/bash
echo "$(pwd -P) $*" >> "$PNPM_LOG"
case "$*" in *"${STUB_FAIL:-none}"*) echo "stand-in $STUB_FAIL error"; exit 1 ;; esac
exit 0
EOF
chmod +x "$SCRATCH/bin/pnpm"
export PATH="$SCRATCH/bin:$PATH"
FAILURES=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
command -v jq >/dev/null 2>&1 || { echo "FAIL: jq is not installed; both hooks need it"; exit 1; }

installed() {  # dir: the dependencies the hooks look for (node_modules is ignored, as in the project)
  mkdir -p "$1/node_modules/.bin"
  printf '#!/bin/bash\nexit 0\n' > "$1/node_modules/.bin/eslint"; cp "$1/node_modules/.bin/eslint" "$1/node_modules/.bin/turbo"
  chmod +x "$1/node_modules/.bin/eslint" "$1/node_modules/.bin/turbo"
}

# MAIN is the main checkout holding the hooks; WT a worktree with its dependencies installed; FRESH a worktree without.
MAIN="$SCRATCH/main"
git init -q -b main "$MAIN"
git -C "$MAIN" config user.name "Hooks Test"; git -C "$MAIN" config user.email "test@example.invalid"
mkdir -p "$MAIN/.claude/hooks" "$MAIN/apps/api/src" "$MAIN/packages/core/src" "$MAIN/docs"
cp "$REPO/.claude/hooks/check-file.sh" "$REPO/.claude/hooks/typecheck.sh" "$MAIN/.claude/hooks/"
printf 'node_modules/\n.claude/worktrees/\n' > "$MAIN/.gitignore"
printf 'packages:\n  - apps/*\n  - packages/*\n' > "$MAIN/pnpm-workspace.yaml"
for f in apps/api/src/a.ts packages/core/src/b.tsx docs/c.ts; do echo "export const x = 1;" > "$MAIN/$f"; done
git -C "$MAIN" add -A; git -C "$MAIN" commit -q -m "chore: start"
git -C "$MAIN" worktree add -q -b wt "$MAIN/.claude/worktrees/wt"
git -C "$MAIN" worktree add -q -b fresh "$MAIN/.claude/worktrees/fresh"
WT="$MAIN/.claude/worktrees/wt"; FRESH="$MAIN/.claude/worktrees/fresh"
installed "$MAIN"; installed "$WT"
# Another project's repository, laid out the same way, which neither hook may act on.
OTHER="$SCRATCH/other"
git init -q -b main "$OTHER"; mkdir -p "$OTHER/apps/x"; echo "export const y = 2;" > "$OTHER/apps/x/d.ts"; installed "$OTHER"

# Runs a hook as Claude Code does in a worktree session: the main checkout's copy, from the main checkout.
run_hook() {  # hook json: prints the hook's stderr, returns its status
  : > "$PNPM_LOG"
  (cd "$MAIN" && printf '%s' "$2" | CLAUDE_PROJECT_DIR="$MAIN" bash "$MAIN/.claude/hooks/$1" >/dev/null) 2>&1
}
write_json() { printf '{"tool_input":{"file_path":"%s"},"cwd":"%s"}' "$1" "${2:-$WT}"; }
stop_json() { printf '{"hook_event_name":"Stop","stop_hook_active":%s,"cwd":"%s"}' "${2:-false}" "$1"; }
ran_in() {  # dir command: the stand-in pnpm ran that command (eslint, prettier, turbo) in that directory
  grep -q "^$1 .*$2" "$PNPM_LOG"
}
ran_nothing() { [ ! -s "$PNPM_LOG" ]; }

test_lint_acts_on_the_main_checkout_for_its_files() {
  run_hook check-file.sh "$(write_json "$MAIN/apps/api/src/a.ts" "$MAIN")" >/dev/null || fail "a clean main-checkout file was refused"
  ran_in "$MAIN" "eslint --no-warn-ignored $MAIN/apps/api/src/a.ts" || fail "the main-checkout file was not linted in the main checkout: $(cat "$PNPM_LOG")"
  ran_in "$MAIN" "prettier --write" || fail "the main-checkout file was not formatted: $(cat "$PNPM_LOG")"
}

test_lint_acts_on_the_worktree_for_its_files() {
  run_hook check-file.sh "$(write_json "$WT/packages/core/src/b.tsx")" >/dev/null || fail "a clean worktree file was refused"
  ran_in "$WT" "eslint --no-warn-ignored $WT/packages/core/src/b.tsx" || fail "the worktree file was not linted in its worktree: $(cat "$PNPM_LOG")"
  grep -q "^$MAIN " "$PNPM_LOG" && fail "linting a worktree file ran in the main checkout: $(cat "$PNPM_LOG")"
  return 0
}

test_a_lint_error_in_a_worktree_file_is_refused() {
  local out status
  out=$(STUB_FAIL=eslint run_hook check-file.sh "$(write_json "$WT/apps/api/src/a.ts")"); status=$?
  [ "$status" = 2 ] || fail "a lint error in a worktree file did not block (exit $status, want 2)"
  printf '%s' "$out" | grep -q "ESLint errors in $WT/apps/api/src/a.ts" || fail "the refusal does not name the file: $out"
  printf '%s' "$out" | grep -q "stand-in eslint error" || fail "the refusal does not carry ESLint's output: $out"
}

test_lint_resolves_a_relative_path_against_the_session_cwd() {
  run_hook check-file.sh "$(write_json "apps/api/src/a.ts")" >/dev/null
  ran_in "$WT" "eslint --no-warn-ignored $WT/apps/api/src/a.ts" || fail "a relative path was not linted in the session's worktree: $(cat "$PNPM_LOG")"
}

test_lint_skips_what_it_does_not_own() {
  local f
  for f in "$WT/docs/c.ts" "$OTHER/apps/x/d.ts" "$WT/.gitignore" "$SCRATCH/nowhere/apps/e.ts"; do
    run_hook check-file.sh "$(write_json "$f")" >/dev/null || fail "$f was refused"
    ran_nothing || fail "$f was linted, though outside apps/ and packages/ of this project: $(cat "$PNPM_LOG")"
  done
}

test_lint_never_blocks_a_worktree_without_dependencies() {
  STUB_FAIL=eslint run_hook check-file.sh "$(write_json "$FRESH/apps/api/src/a.ts" "$FRESH")" >/dev/null \
    || fail "an edit in a worktree without installed dependencies was blocked"
  ran_nothing || fail "pnpm ran in a worktree without installed dependencies: $(cat "$PNPM_LOG")"
}

test_typecheck_acts_on_the_session_checkout() {
  run_hook typecheck.sh "$(stop_json "$MAIN")" >/dev/null || fail "a clean typecheck of the main checkout blocked"
  ran_in "$MAIN" "turbo run typecheck" || fail "a main-checkout session was not typechecked in the main checkout: $(cat "$PNPM_LOG")"
  run_hook typecheck.sh "$(stop_json "$WT")" >/dev/null || fail "a clean typecheck of the worktree blocked"
  ran_in "$WT" "turbo run typecheck" || fail "a worktree session was not typechecked in its worktree: $(cat "$PNPM_LOG")"
  run_hook typecheck.sh "$(stop_json "$WT/apps/api")" >/dev/null
  ran_in "$WT" "turbo run typecheck" || fail "a session cd'd into a worktree's subfolder was not typechecked at the worktree's root: $(cat "$PNPM_LOG")"
}

test_a_type_error_in_the_worktree_blocks_the_turn() {
  local out status
  out=$(STUB_FAIL=turbo run_hook typecheck.sh "$(stop_json "$WT")"); status=$?
  [ "$status" = 2 ] || fail "a failing worktree typecheck did not block the turn (exit $status, want 2)"
  printf '%s' "$out" | grep -q "Typecheck failed in $WT" || fail "the block does not name the worktree: $out"
}

test_typecheck_falls_back_to_the_project_dir() {
  local cwd
  for cwd in "$OTHER" "$SCRATCH/home" ""; do
    run_hook typecheck.sh "$(stop_json "$cwd")" >/dev/null
    ran_in "$MAIN" "turbo run typecheck" || fail "cwd '$cwd' (not a checkout of this project) did not fall back to CLAUDE_PROJECT_DIR: $(cat "$PNPM_LOG")"
  done
}

test_typecheck_skips_an_active_stop_hook_and_a_worktree_without_dependencies() {
  STUB_FAIL=turbo run_hook typecheck.sh "$(stop_json "$WT" true)" >/dev/null || fail "a second stop (stop_hook_active) was blocked"
  ran_nothing || fail "typecheck ran while the stop hook was already active: $(cat "$PNPM_LOG")"
  STUB_FAIL=turbo run_hook typecheck.sh "$(stop_json "$FRESH")" >/dev/null || fail "a worktree without installed dependencies blocked the turn"
  ran_nothing || fail "pnpm ran in a worktree without installed dependencies: $(cat "$PNPM_LOG")"
}

test_lint_acts_on_the_main_checkout_for_its_files
test_lint_acts_on_the_worktree_for_its_files
test_a_lint_error_in_a_worktree_file_is_refused
test_lint_resolves_a_relative_path_against_the_session_cwd
test_lint_skips_what_it_does_not_own
test_lint_never_blocks_a_worktree_without_dependencies
test_typecheck_acts_on_the_session_checkout
test_a_type_error_in_the_worktree_blocks_the_turn
test_typecheck_falls_back_to_the_project_dir
test_typecheck_skips_an_active_stop_hook_and_a_worktree_without_dependencies
[ "$FAILURES" -eq 0 ] && echo "claude hooks tests passed" || echo "claude hooks tests: $FAILURES failure(s)"
[ "$FAILURES" -eq 0 ]
