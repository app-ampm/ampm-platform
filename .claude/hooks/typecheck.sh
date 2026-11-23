#!/bin/bash
# Claude cannot finish a turn while typecheck fails; skips when the stop hook is already active, so it never loops.
# Runs beside checkpoint.sh and the memory hook. Claude Code runs this hook from the main checkout (CLAUDE_PROJECT_DIR)
# even when the session works in a worktree under .claude/worktrees/, so the checkout is the session's working
# directory (the Stop JSON's cwd) when that is a checkout of this project, else CLAUDE_PROJECT_DIR. Never blocks on a
# missing tool: a fresh worktree has no dependencies until `pnpm install`.
INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
PROJECT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
common_dir() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }
ROOT="$PROJECT"
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty')
if [ -n "$CWD" ] && TOP=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null) \
  && [ "$(common_dir "$TOP")" = "$(common_dir "$PROJECT")" ]; then
  ROOT="$TOP"
fi
cd "$ROOT" || exit 0
# The checkout's Node (.nvmrc) when nvm is installed; otherwise whatever node is on PATH.
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; nvm use --silent >/dev/null 2>&1; fi
[ -x node_modules/.bin/turbo ] && command -v pnpm >/dev/null 2>&1 || exit 0
OUT=$(pnpm turbo run typecheck 2>&1); STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo "Typecheck failed in $ROOT — fix these before finishing:" >&2
  echo "$OUT" | tail -n 40 >&2
  exit 2
fi
exit 0
