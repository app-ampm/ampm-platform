#!/bin/bash
# Formats and lints every TypeScript or JavaScript file Claude writes under apps/ or packages/; errors go back to Claude
# (exit 2 blocks the action). Claude Code runs this hook from the main checkout (CLAUDE_PROJECT_DIR) even when the
# session edits a worktree under .claude/worktrees/, so the checkout is the one that holds the edited file. Never
# blocks an edit on a missing tool: a fresh worktree has no dependencies until `pnpm install`.
INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')
case "$FILE" in *.ts|*.tsx|*.js|*.mjs) ;; *) exit 0 ;; esac
case "$FILE" in /*) ;; *) FILE="$(printf '%s' "$INPUT" | jq -r '.cwd // "."')/$FILE" ;; esac
PROJECT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
common_dir() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }
# The checkout holding the file and the file's path inside it; only a checkout of this project (the main checkout or
# one of its worktrees, which share one git directory) is linted.
{ read -r ROOT; read -r PREFIX; } < <(git -C "$(dirname "$FILE")" rev-parse --show-toplevel --show-prefix 2>/dev/null)
[ -n "$ROOT" ] && [ "$(common_dir "$ROOT")" = "$(common_dir "$PROJECT")" ] || exit 0
case "$PREFIX$(basename "$FILE")" in apps/*|packages/*) ;; *) exit 0 ;; esac
cd "$ROOT" || exit 0
# The checkout's Node (.nvmrc) when nvm is installed; otherwise whatever node is on PATH.
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; nvm use --silent >/dev/null 2>&1; fi
[ -x node_modules/.bin/eslint ] && command -v pnpm >/dev/null 2>&1 || exit 0
pnpm exec prettier --write "$FILE" >/dev/null 2>&1
if ! OUT=$(pnpm exec eslint --no-warn-ignored "$FILE" 2>&1); then
  echo "ESLint errors in $FILE — fix them before continuing:" >&2
  echo "$OUT" >&2
  exit 2
fi
exit 0
