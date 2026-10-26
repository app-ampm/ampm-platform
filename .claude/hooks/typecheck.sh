#!/bin/bash
# Claude cannot finish a turn while typecheck fails. Inert until the monorepo exists; skips when the stop hook
# is already active, so it never loops. Runs beside checkpoint.sh and the memory hook.
INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
ROOT="${CLAUDE_PROJECT_DIR:-.}"
# Use the repository's Node (.nvmrc) when nvm is installed; the hooks otherwise run on whatever node is on PATH.
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; (cd "$ROOT" && nvm use --silent >/dev/null 2>&1); PATH="$(cd "$ROOT" && nvm which current 2>/dev/null | xargs dirname 2>/dev/null):$PATH"; fi
[ -f "$ROOT/pnpm-workspace.yaml" ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
cd "$ROOT" || exit 0
OUT=$(pnpm turbo run typecheck 2>&1); STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo "Typecheck failed — fix these before finishing:" >&2
  echo "$OUT" | tail -n 40 >&2
  exit 2
fi
exit 0
