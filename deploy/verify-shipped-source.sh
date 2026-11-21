#!/usr/bin/env bash
# Checks that this source tree is exactly what deploy/ship-source.sh shipped (D-156): .deployed-manifest
# names the commit in .deployed-commit, and every file it lists is unchanged. redeploy-prod.sh runs it
# before it builds, so a tree shipped by hand (`git archive | tar` leaves the files a commit deleted in
# place, and the image build compiles them) or edited on the box is refused. Files the manifest does not
# list, such as compose.box.yml and the Compose .env, are the box's own and are not checked.
#   bash deploy/verify-shipped-source.sh
set -euo pipefail
cd "$(dirname "$0")/.."

fail() {
  printf 'verify-shipped-source: %s\n' "$*" >&2
  exit 1
}

[[ -f .deployed-commit ]] || fail "missing .deployed-commit"
[[ -f .deployed-manifest ]] || fail "missing .deployed-manifest: ship the source with deploy/ship-source.sh"
commit="$(tr -d '[:space:]' <.deployed-commit)"
[[ "$(head -n 1 .deployed-manifest)" == "# ampm-ship-manifest $commit" ]] ||
  fail ".deployed-manifest was not written for .deployed-commit's ${commit:0:12}: ship with deploy/ship-source.sh"
if ! bad="$(tail -n +2 .deployed-manifest | sha256sum -c --quiet --strict - 2>&1)"; then
  printf '%s\n' "$bad" | sed -n '1,40p' >&2
  fail "the files above differ from ${commit:0:12} as shipped: re-ship it with deploy/ship-source.sh"
fi
echo "source tree is ${commit:0:12} as shipped, $(($(wc -l <.deployed-manifest) - 1)) files"
