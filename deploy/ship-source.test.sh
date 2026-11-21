#!/usr/bin/env bash
# End-to-end test of deploy/ship-source.sh and deploy/verify-shipped-source.sh against a stand-in box
# (D-156): a scratch git repository holding copies of both scripts, an `ssh` shim that runs each remote
# command in a scratch home, and ships covering what a plain `git archive | tar` got wrong (deleted and
# renamed files, emptied directories, a path that turns from file to directory and back) plus the box's
# own files, the knowledge graph, a hand edit, a hand-made ship and a box on an unknown commit.
#   bash deploy/ship-source.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
repo="$work/repo"
home="$work/home"
box="$home/ampm-prod"
failures=0
status=0

ok() { printf 'ok   %s\n' "$1"; }
bad() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}
has() { if [[ -f "$box/$1" ]]; then ok "box has $1"; else bad "box lacks $1"; fi; }
lacks() { if [[ ! -e "$box/$1" ]]; then ok "box has no $1"; else bad "box still has $1"; fi; }
holds() {
  local got
  got="$(cat "$box/$1" 2>/dev/null || true)"
  if [[ "$got" == "$2" ]]; then ok "$1 holds '$2'"; else bad "$1 holds '$got', not '$2'"; fi
}
said() { if grep -qF -- "$1" "$work/out"; then ok "output names $1"; else bad "output does not name $1"; fi; }
exits() {
  if [[ "$status" == "$1" ]]; then
    ok "$2 exits $1"
  else
    bad "$2 exits $status, not $1"
    sed 's/^/     | /' "$work/out" >&2
  fi
}

# The stand-in for ssh: drop the options and the host, run the command in the stand-in box's home.
mkdir -p "$work/bin" "$home"
cat >"$work/bin/ssh" <<'SHIM'
#!/usr/bin/env bash
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o | -i | -O | -p | -l | -F) shift 2 ;;
    -*) shift ;;
    *) break ;;
  esac
done
shift
[[ $# -gt 0 ]] || exit 0
cd "$STAND_IN_HOME" && exec bash -c "$*"
SHIM
chmod +x "$work/bin/ssh"

# ship <commit> [NAME=value ...]: run the ship script through the shim; output in $work/out.
ship() {
  local target="$1"
  shift
  status=0
  env PATH="$work/bin:$PATH" STAND_IN_HOME="$home" AMPM_SHIP_TARGET=production SHIP_SSH=deploy@box.invalid \
    "$@" bash "$repo/deploy/ship-source.sh" "$target" >"$work/out" 2>&1 || status=$?
}
verify() {
  status=0
  bash "$box/deploy/verify-shipped-source.sh" >"$work/out" 2>&1 || status=$?
}

git init -q "$repo"
g() { git -C "$repo" -c user.name=ship-test -c user.email=ship-test@example.invalid "$@"; }
put() {
  mkdir -p "$(dirname "$repo/$1")"
  printf '%s\n' "$2" >"$repo/$1"
}
commit() {
  g add -A
  g commit -qm "$1"
  g rev-parse HEAD
}

mkdir -p "$repo/deploy"
cp "$here/ship-source.sh" "$here/verify-shipped-source.sh" "$repo/deploy/"
put apps/api/src/kept.ts kept
put apps/api/src/gone.ts gone
put apps/api/src/old-name.ts renamed
put infra/aws/lambda/pretoken/index.mjs lambda
put docs/notes.md one
put becomes-a-dir "a file"
put becomes-a-file/inner.txt "inside a directory"
put graphify-out/graph.json graph
c1="$(commit c1)"

echo "# 1. The first ship, into an empty directory"
ship "$c1"
exits 0 "the first ship"
has apps/api/src/gone.ts
has becomes-a-dir
lacks graphify-out
holds .deployed-commit "$c1"
verify
exits 0 "verify-shipped-source after it"
# The box's own files, which no commit tracks.
mkdir -p "$box/infra/compose/production"
echo own >"$box/infra/compose/production/compose.box.yml"
echo own >"$box/infra/compose/production/.env"

g rm -q apps/api/src/gone.ts infra/aws/lambda/pretoken/index.mjs becomes-a-dir becomes-a-file/inner.txt
g mv apps/api/src/old-name.ts apps/api/src/new-name.ts
put docs/notes.md two
put becomes-a-dir/inner.txt "now a directory"
put becomes-a-file "now a file"
put graphify-out/graph.json "graph 2"
c2="$(commit c2)"

echo "# 2. A commit that deletes, renames, empties a directory and swaps a file and a directory"
ship "$c2"
exits 0 "the second ship"
lacks apps/api/src/gone.ts
lacks apps/api/src/old-name.ts
has apps/api/src/new-name.ts
lacks infra/aws
has infra/compose/production/compose.box.yml
has infra/compose/production/.env
holds docs/notes.md two
has becomes-a-dir/inner.txt
holds becomes-a-file "now a file"
lacks graphify-out
holds .deployed-commit "$c2"
said apps/api/src/gone.ts
said ./infra/compose/production/compose.box.yml
verify
exits 0 "verify-shipped-source after it"

put apps/api/src/kept.ts "kept, changed"
c3="$(commit c3)"

echo "# 3. A hand edit on the box: verify-shipped-source fails, and a ship refuses before changing anything"
echo "edited on the box" >"$box/docs/notes.md"
verify
exits 1 "verify-shipped-source over the edit"
ship "$c3"
exits 3 "a ship over the edit"
said docs/notes.md
holds apps/api/src/kept.ts kept
holds .deployed-commit "$c2"

echo "# 4. SHIP_FORCE=1 ships over the edit"
ship "$c3" SHIP_FORCE=1
exits 0 "a forced ship"
holds docs/notes.md two
holds apps/api/src/kept.ts "kept, changed"
holds .deployed-commit "$c3"
verify
exits 0 "verify-shipped-source after it"

echo "# 5. A ship made by hand (git archive | tar) is refused before a build"
g archive "$c2" -- . ':(exclude)graphify-out' | tar -x -C "$box"
printf '%s\n' "$c2" >"$box/.deployed-commit"
verify
exits 1 "verify-shipped-source over a hand-made ship"
said "was not written for"

echo "# 6. A box on a commit this checkout does not have is refused"
echo ffffffffffffffffffffffffffffffffffffffff >"$box/.deployed-commit"
ship "$c3"
exits 3 "a ship over an unknown commit"
said "which this checkout does not have"

if ((failures > 0)); then
  echo "$failures ship-source check(s) failed" >&2
  exit 1
fi
echo "all ship-source checks passed"
