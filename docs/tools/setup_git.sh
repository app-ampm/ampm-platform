#!/bin/bash
# One-time setup after cloning ampm-platform: project-account identity, credential helper,
# post-commit hook, and the vault repository cloned into vault/. Safe to re-run.
set -e
cd "$(dirname "$0")/../.."
ACCOUNT=app-ampm
EMAIL="346982075+app-ampm@users.noreply.github.com"
NAME="Amardeep Singh"
HELPER="$PWD/docs/tools/git-credential-ampm.sh"
configure() {
  git -C "$1" config --local user.name "$NAME"
  git -C "$1" config --local user.email "$EMAIL"
  git -C "$1" config --local credential.helper "!$HELPER"
  git -C "$1" config --local core.quotepath false
  echo "$1: identity and credential helper set to $ACCOUNT"
}
configure .
cp docs/tools/git-hooks/post-commit .git/hooks/post-commit && chmod +x .git/hooks/post-commit && echo ".: post-commit hook installed"
if [ ! -d vault/.git ]; then
  git -c credential.helper="!$HELPER" clone "https://$ACCOUNT@github.com/$ACCOUNT/ampm-vault.git" vault
fi
configure vault
cat <<EOT
Timer (commits Obsidian edits every ten minutes): check the path inside docs/tools/com.ampm.vault-sync.plist, then
  cp docs/tools/com.ampm.vault-sync.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/com.ampm.vault-sync.plist
EOT
