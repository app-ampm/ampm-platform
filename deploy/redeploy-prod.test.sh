#!/usr/bin/env bash
# Test of deploy/redeploy-prod.sh's app-image prune (the lines after the health gate passes) against a
# `docker` stub: a release keeps itself and the image it replaced, the rollback target, and drops older
# ones; a rerun of the same commit (an environment change) and a first deploy name no new target, so they
# drop nothing. A same-commit rerun used to keep the running image alone and delete the image a rollback
# by hand needs (the Slice 3 rollback, docs/data-model.md). The block is cut from the script itself, so
# the test runs what the box runs.
#   bash deploy/redeploy-prod.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

ok() { printf 'ok   %s\n' "$1"; }
bad() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

# From the line that records the image that passed to the line before the closing health print.
block="$(awk '
  /^printf .%s\\n. "\$AMPM_IMAGE" >"\$STATE\/app-image"/ { on = 1 }
  on && /^curl -s "http:\/\/127\.0\.0\.1/ { exit }
  on { print }
' "$here/redeploy-prod.sh")"
if [[ -z "$block" ]]; then
  echo "FAIL could not find the prune block in deploy/redeploy-prod.sh" >&2
  exit 1
fi

mkdir -p "$work/bin"
cat >"$work/bin/docker" <<'STUB'
#!/usr/bin/env bash
if [[ "$1 $2" == "image ls" ]]; then
  printf '%s\n' ampm-prod-app:aaaaaaaaaaaa ampm-prod-app:bbbbbbbbbbbb ampm-prod-app:cccccccccccc
elif [[ "$1 $2" == "image rm" ]]; then
  printf '%s\n' "$3" >>"$REMOVED"
fi
STUB
chmod +x "$work/bin/docker"

# prune <case> <image that passed> <image it replaced, or ""> <images expected removed, space-separated>
prune() {
  local state="$work/$1"
  mkdir -p "$state"
  : >"$state/removed"
  REMOVED="$state/removed" PATH="$work/bin:$PATH" AMPM_IMAGE="$2" previous_app="$3" STATE="$state" \
    bash -c "set -euo pipefail; log() { :; }; write_compose_env() { :; }; $block"
  local removed recorded
  removed="$(sort "$state/removed" | tr '\n' ' ' | sed 's/ $//')"
  recorded="$(cat "$state/app-image")"
  if [[ "$removed" == "$4" ]]; then ok "$1 removes '${4:-nothing}'"; else bad "$1 removes '${removed:-nothing}', not '${4:-nothing}'"; fi
  if [[ "$recorded" == "$2" ]]; then ok "$1 records $2"; else bad "$1 records '$recorded', not $2"; fi
}

prune "a new release" ampm-prod-app:cccccccccccc ampm-prod-app:bbbbbbbbbbbb ampm-prod-app:aaaaaaaaaaaa
prune "a rerun of the same commit" ampm-prod-app:cccccccccccc ampm-prod-app:cccccccccccc ""
prune "a first deploy" ampm-prod-app:cccccccccccc "" ""

if ((failures > 0)); then
  echo "$failures redeploy-prod check(s) failed" >&2
  exit 1
fi
echo "all redeploy-prod checks passed"
