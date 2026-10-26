#!/bin/bash
# Formats and lints every TypeScript file Claude writes; errors go back to Claude (exit 2 blocks the action).
# Inert until the monorepo exists (pnpm-workspace.yaml at the repository root) and pnpm is installed.
INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
case "$FILE" in *.ts|*.tsx|*.js|*.mjs) ;; *) exit 0 ;; esac
ROOT="${CLAUDE_PROJECT_DIR:-.}"
# Use the repository's Node (.nvmrc) when nvm is installed; the hooks otherwise run on whatever node is on PATH.
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; (cd "$ROOT" && nvm use --silent >/dev/null 2>&1); PATH="$(cd "$ROOT" && nvm which current 2>/dev/null | xargs dirname 2>/dev/null):$PATH"; fi
[ -f "$ROOT/pnpm-workspace.yaml" ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
cd "$ROOT" || exit 0
case "$FILE" in "$ROOT"/apps/*|"$ROOT"/packages/*|apps/*|packages/*) ;; *) exit 0 ;; esac
# Until bootstrap step 3 installs the shared ESLint and Prettier, there is nothing to run; never block an edit on a missing tool.
pnpm exec eslint --version >/dev/null 2>&1 || exit 0
pnpm exec prettier --write "$FILE" >/dev/null 2>&1
if ! OUT=$(pnpm exec eslint --no-warn-ignored "$FILE" 2>&1); then
  echo "ESLint errors in $FILE — fix them before continuing:" >&2
  echo "$OUT" >&2
  exit 2
fi
exit 0
