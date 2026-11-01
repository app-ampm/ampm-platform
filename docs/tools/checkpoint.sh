#!/bin/bash
# Commit the project if anything changed, sync the Obsidian vault (vault/), then file the docs into the MemPalace wing.
# Runs from the Claude Code Stop hook at the end of every turn (--hook) and by hand:
#   bash docs/tools/checkpoint.sh ["commit message"]
# In hook mode the hook JSON on stdin is passed on (AMPM_SESSION_JSON) so vault_sync.py can refresh the session journal,
# all output goes to ~/Library/Logs/ampm-vault-sync.log, and a one-line JSON systemMessage is printed only when a commit
# was made or a push failed, so Claude Code can show it. Commits an earlier run left unpushed are pushed again on every
# run, and while the remote refuses them every turn says so (a branch that has split from its upstream stays visible).
set -u
cd "$(dirname "$0")/../.." || exit 0
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Automated checkpoints skip the lefthook git hooks (staged lint, commitlint): they may run from launchd without
# node on PATH, and their file-list subjects exceed commitlint's header limit. CI and the Claude hooks are their gate.
export LEFTHOOK=0
LOG="$HOME/Library/Logs/ampm-vault-sync.log"
HOOK=0; MSG=""; COMMITTED=""; PUSH_FAILED=""
for a in "$@"; do case "$a" in --hook) HOOK=1 ;; *) MSG="$a" ;; esac; done
if [ "$HOOK" = 1 ] && [ ! -t 0 ]; then
  AMPM_SESSION_JSON=$(cat 2>/dev/null || true); export AMPM_SESSION_JSON
fi

# True in a git repository, whether the main checkout (.git is a dir) or a worktree (.git is a file) — so
# the checkpoint commits inside the worktrees every session runs in, not only the main checkout (F9).
in_git_repo() { git rev-parse --is-inside-work-tree >/dev/null 2>&1; }

push() {  # pushes the branch when it has commits its upstream lacks; PUSH_FAILED counts them when the push is refused
  git rev-parse -q --verify '@{upstream}' >/dev/null 2>&1 || return 0
  local ahead; ahead=$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo 0)
  [ "$ahead" -gt 0 ] || return 0
  # Scan before the push, not only in CI: the hook runs `git add -A` with lefthook disabled, and
  # .gitignore un-ignores infra/secrets/examples/*.yaml, so a secret a session wrote could otherwise
  # reach the remote before CI's secrets-scan could refuse it (F8). Fail closed when the scan flags the
  # tree; the scanner is skipped only where it is absent (e.g. a throwaway repo), not in this project.
  if [ -f docs/tools/scan_secrets.py ] && ! python3 docs/tools/scan_secrets.py >/dev/null 2>&1; then
    PUSH_FAILED="$ahead"
    echo "project: push blocked — secret scan flagged the tree (run docs/tools/scan_secrets.py); not pushing"
    return 0
  fi
  if git push -q; then echo "project: pushed"
  else
    ahead=$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo "$ahead")
    PUSH_FAILED="$ahead"; echo "project: push failed ($ahead commit(s) not on $(git rev-parse --abbrev-ref '@{upstream}'))"
  fi
}

run() {
  if in_git_repo && [ -z "$(git config --local user.email)" ]; then
    echo "project: no repository-local git identity (user.email), not committing"
  elif in_git_repo; then
    git add -A
    if git diff --cached --quiet; then
      echo "project: nothing to commit"
      push
    else
      n=$(git diff --cached --name-only | wc -l | tr -d ' ')
      files=$(git diff --cached --name-only | head -3 | paste -sd ',' - | sed 's/,/, /g')
      [ "$n" -gt 3 ] && files="$files (+$((n-3)) more)"
      msg="${MSG:-chore: checkpoint $(date '+%Y-%m-%d %H:%M'): $files}"
      if git commit -q -m "$msg" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"; then
        COMMITTED="$msg"; echo "project: committed: $msg"
        push
      else
        echo "project: commit failed"
      fi
    fi
  fi
  python3 docs/tools/vault_sync.py
  if [ -n "$COMMITTED" ] && command -v mempalace >/dev/null 2>&1; then
    # file new or changed design docs into the project's memory wing (MemPalace skips files already filed)
    ( mempalace mine docs --mode projects --wing ampm >> "$HOME/Library/Logs/ampm-memory-hooks.log" 2>&1 & ) >/dev/null 2>&1
    echo "memory: docs/ queued for the MemPalace wing ampm"
  fi
}

if [ "$HOOK" = 1 ]; then
  mkdir -p "$(dirname "$LOG")"
  { echo "== $(date '+%Y-%m-%d %H:%M:%S') checkpoint (Claude Code Stop hook)"; run; } >> "$LOG" 2>&1
  if [ -n "$PUSH_FAILED" ]; then
    note="push to origin failed, $PUSH_FAILED commit(s) not pushed (the branch may have split from its upstream;"
    note="$note see ~/Library/Logs/ampm-vault-sync.log)"
    [ -n "$COMMITTED" ] && note="$COMMITTED; $note"
    esc=$(printf '%s' "$note" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '{"systemMessage": "AMPM checkpoint: %s"}\n' "$esc"
  elif [ -n "$COMMITTED" ]; then
    esc=$(printf '%s' "$COMMITTED" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '{"systemMessage": "AMPM checkpoint: %s; vault synced"}\n' "$esc"
  fi
  exit 0
fi
run
