#!/bin/sh
# Git credential helper bound to the AMPM project's GitHub account (app-ampm).
# It returns that account's token from the GitHub CLI keyring whichever gh account is active,
# so pushes from this project always go through the project account. No secret is stored here.
# Configured per repository by docs/tools/setup_git.sh:
#   git config credential.helper '!/absolute/path/to/docs/tools/git-credential-ampm.sh'
ACCOUNT=app-ampm
HOST=github.com
GH=$(command -v gh 2>/dev/null || echo /opt/homebrew/bin/gh)
[ "$1" = "get" ] || exit 0
host=""
while IFS= read -r line; do
  case "$line" in
    host=*) host="${line#host=}" ;;
    "") break ;;
  esac
done
[ -z "$host" ] || [ "$host" = "$HOST" ] || exit 0
token=$("$GH" auth token --hostname "$HOST" --user "$ACCOUNT" 2>/dev/null) || exit 0
[ -n "$token" ] || exit 0
printf 'username=%s\npassword=%s\n' "$ACCOUNT" "$token"
