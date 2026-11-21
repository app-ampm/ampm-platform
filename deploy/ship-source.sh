#!/usr/bin/env bash
# Ship one commit's source to a stack's directory on the shared Plesk box (D-138), so the box builds
# exactly that commit (D-156). A plain `git archive <commit> | ssh <box> 'tar -xf -'` only adds and
# replaces files: a file deleted or renamed on main stayed on the box, and the image build still
# compiled it (#167's five deleted Cognito sources would have failed the API build on 21 Nov 2026).
#
#   1  check that the box's tree is still the commit in its .deployed-commit; refuse, listing the files,
#      when something was edited by hand or an earlier ship did not finish
#   2  remove the files that commit has and the new one does not, then any directory left empty
#   3  unpack `git archive <commit>`, without the knowledge graph
#   4  write .deployed-manifest (the commit, then every file's SHA-256) and .deployed-commit, and check
#      the tree against them; redeploy-prod.sh checks them again (deploy/verify-shipped-source.sh)
# Files no commit tracks (compose.box.yml, the Compose .env) are never touched; the ones found are listed.
#
# Usage, from a checkout (the commit defaults to origin/main, fetched first):
#   AMPM_SHIP_TARGET=production SHIP_SSH=app_ampmverse@31.97.62.74 SHIP_SSH_KEY=~/.ssh/ampm_test_vps \
#     bash deploy/ship-source.sh [<commit>]
#
# Env:
#   AMPM_SHIP_TARGET  (required) production (~/ampm-prod) | test (~/ampm-test)
#   SHIP_SSH          (required) ssh target for the box
#   SHIP_SSH_KEY      offer only this key: an agent's other keys count as failed logins with fail2ban
#   SHIP_DIR          the source directory on the box, under the SSH user's home or absolute
#                     (defaults per target, above)
#   SHIP_FORCE=1      ship over a tree that no longer matches its .deployed-commit: the files that
#                     differ are listed, then replaced
set -euo pipefail

: "${AMPM_SHIP_TARGET:?set AMPM_SHIP_TARGET=production or test}"
: "${SHIP_SSH:?set SHIP_SSH=user@host}"

case "$AMPM_SHIP_TARGET" in
  production)
    DIR="${SHIP_DIR:-ampm-prod}"
    NEXT="bash $DIR/deploy/redeploy-prod.sh"
    ;;
  test)
    DIR="${SHIP_DIR:-ampm-test}"
    NEXT="bash $DIR/deploy/redeploy-box.sh (deploy/redeploy-site.sh for the website)"
    ;;
  *)
    echo "AMPM_SHIP_TARGET must be production or test, not '$AMPM_SHIP_TARGET'" >&2
    exit 2
    ;;
esac
# The path goes into remote commands in single quotes, so it is kept to plain characters.
if [[ ! "$DIR" =~ ^/?[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$ || "$DIR" == *..* ]]; then
  echo "SHIP_DIR must be a plain path, not '$DIR'" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ $# -gt 0 ]]; then
  ref="$1"
else
  git -C "$ROOT" fetch --quiet origin main
  ref=origin/main
fi
commit="$(git -C "$ROOT" rev-parse --verify --quiet "$ref^{commit}")" || {
  echo "not a commit in this checkout: $ref" >&2
  exit 2
}

tmp="$(mktemp -d)"
# Every step goes over one connection (ControlMaster), so the box's fail2ban sees a single login.
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15
  -o ControlMaster=auto -o "ControlPath=$tmp/ssh" -o ControlPersist=60)
if [[ -n "${SHIP_SSH_KEY:-}" ]]; then SSH+=(-o IdentitiesOnly=yes -i "$SHIP_SSH_KEY"); fi
cleanup() {
  "${SSH[@]}" -O exit "$SHIP_SSH" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT
box() { "${SSH[@]}" "$SHIP_SSH" "$@"; }

if command -v sha256sum >/dev/null 2>&1; then SUM=(sha256sum); else SUM=(shasum -a 256); fi
short() { printf '%s' "${1:0:12}"; }

# Unpack `git archive <commit>` (without the graph) into $tmp/<name>; list its files in <name>.files.
unpack() {
  mkdir "$tmp/$2"
  git -C "$ROOT" archive "$1" -- . ':(exclude)graphify-out' | tar -x -C "$tmp/$2"
  (cd "$tmp/$2" && find . -type f -print0 | LC_ALL=C sort -z) >"$tmp/$2.files"
}
# Every file of an unpacked tree with its SHA-256, in the form `sha256sum -c` reads.
sums() { (cd "$tmp/$1" && xargs -0 "${SUM[@]}" <"$tmp/$1.files"); }
# Each path's parent directories (not the top), deepest first, once each.
parent_dirs() {
  local path
  while IFS= read -r path; do
    while [[ "$path" == */* ]]; do
      path="${path%/*}"
      printf '%s\n' "$path"
    done
  done | LC_ALL=C sort -u | awk -F/ '{ print NF "\t" $0 }' | LC_ALL=C sort -t $'\t' -k1,1nr | cut -f2-
}

echo "Shipping $(short "$commit") to $SHIP_SSH:$DIR ($AMPM_SHIP_TARGET) ..."
deployed="$(box "mkdir -p '$DIR' && cat '$DIR/.deployed-commit' 2>/dev/null || true" | tr -d '[:space:]')"

# 1. The box's tree must still be the commit it was given, or the removals below would be wrong.
old=""
if [[ -n "$deployed" ]]; then
  if old="$(git -C "$ROOT" rev-parse --verify --quiet "$deployed^{commit}")"; then
    echo "The box holds $(short "$old"); checking nothing has changed there since ..."
    unpack "$old" old
    sums old >"$tmp/old.sums"
    if ! drift="$(box "cd '$DIR' && sha256sum -c --quiet --strict -" <"$tmp/old.sums" 2>&1)"; then
      printf '%s\n' "$drift" | sed -n '1,40p' >&2
      if [[ "${SHIP_FORCE:-}" != 1 ]]; then
        echo "REFUSED: these files differ from $(short "$old") (a hand edit, or a ship that did not finish)." >&2
        echo "         Copy anything worth keeping off the box, then re-run with SHIP_FORCE=1 to replace them." >&2
        exit 3
      fi
      echo "SHIP_FORCE=1: shipping over them." >&2
    fi
  elif [[ "${SHIP_FORCE:-}" == 1 ]]; then
    echo "SHIP_FORCE=1: the box's $deployed is not in this checkout, so nothing is removed." >&2
  else
    echo "REFUSED: the box holds '$deployed', which this checkout does not have (git fetch?), so the" >&2
    echo "         files to remove cannot be worked out. SHIP_FORCE=1 ships without removing any." >&2
    exit 3
  fi
fi

# 2. Remove what the new commit no longer has. --no-renames: a renamed file is gone at its old path.
if [[ -n "$old" ]]; then
  git -C "$ROOT" diff --name-only --no-renames -z --diff-filter=D "$old" "$commit" \
    -- . ':(exclude)graphify-out' >"$tmp/gone"
  if [[ -s "$tmp/gone" ]]; then
    echo "Removing what $(short "$commit") no longer has:"
    tr '\0' '\n' <"$tmp/gone" | sed 's/^/  - /'
    box "cd '$DIR' && xargs -0 rm -f --" <"$tmp/gone"
    # Then their directories, deepest first; rmdir keeps any that still hold something.
    tr '\0' '\n' <"$tmp/gone" | parent_dirs >"$tmp/gone.dirs"
    box "cd '$DIR' && while IFS= read -r d; do rmdir -- \"\$d\" 2>/dev/null || :; done" <"$tmp/gone.dirs"
  fi
fi

# 3. Unpack the new commit. Removing first lets a path change between file and directory.
unpack "$commit" new
echo "Unpacking $(short "$commit") ..."
git -C "$ROOT" archive "$commit" -- . ':(exclude)graphify-out' | box "cd '$DIR' && tar -xf -"

# 4. Record it, and check the tree against the record.
{
  printf '# ampm-ship-manifest %s\n' "$commit"
  sums new
} >"$tmp/manifest"
box "cd '$DIR' && cat >.deployed-manifest.tmp && mv .deployed-manifest.tmp .deployed-manifest \
  && printf '%s\n' '$commit' >.deployed-commit" <"$tmp/manifest"
if ! bad="$(box "cd '$DIR' && tail -n +2 .deployed-manifest | sha256sum -c --quiet --strict -" 2>&1)"; then
  printf '%s\n' "$bad" | sed -n '1,40p' >&2
  echo "FAILED: the box's tree does not match $(short "$commit") after unpacking (listed above)." >&2
  exit 4
fi

box "cd '$DIR' && find . -type f -print" | LC_ALL=C sort >"$tmp/box.list"
tr '\0' '\n' <"$tmp/new.files" | LC_ALL=C sort >"$tmp/new.list"
extra="$(LC_ALL=C comm -23 "$tmp/box.list" "$tmp/new.list" |
  grep -vxF -e ./.deployed-commit -e ./.deployed-manifest || true)"
if [[ -n "$extra" ]]; then
  echo "On the box but not in $(short "$commit") (box-only files such as compose.box.yml belong here):"
  printf '%s\n' "$extra" | sed 's/^/  /'
fi
echo "Done: $DIR holds $(short "$commit") exactly, $(wc -l <"$tmp/new.list" | tr -d ' ') files."
echo "Next, on the box: $NEXT"
