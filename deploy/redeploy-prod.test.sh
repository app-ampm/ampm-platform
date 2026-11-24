#!/usr/bin/env bash
# Test of deploy/redeploy-prod.sh's app-image prune (the lines after the health gate passes) against a
# `docker` stub: a release keeps itself and the image it replaced, the rollback target, and drops older
# ones; a rerun of the same commit (an environment change) and a first deploy name no new target, so they
# drop nothing. A same-commit rerun used to keep the running image alone and delete the image a rollback
# by hand needs (the Slice 3 rollback, docs/data-model.md). Every successful deploy also trims the build
# cache to 8 GiB, least recently used first, once (D-186). The 7-day window it replaces freed nothing: with
# a deploy a day, no entry got that old. A prune that fails is logged with the daemon's own error and the
# deploy carries on, since the release has passed its gate. The block is cut from the script itself, so
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
elif [[ "$1 $2" == "builder prune" ]]; then
  shift 2
  printf '%s\n' "$*" >>"$BUILDER"
  if [[ -n "${STUB_PRUNE_ERROR:-}" ]]; then
    printf '%s\n' "$STUB_PRUNE_ERROR" >&2
    exit 1
  fi
  echo "Total reclaimed space: 0B"
fi
STUB
chmod +x "$work/bin/docker"

# prune <case> <image that passed> <image it replaced, or ""> <images expected removed, space-separated>
#   [NAME=value ...]: runs the block with the stub; what it logs is in $work/<case>/log.
prune() {
  local state="$work/$1" status=0
  mkdir -p "$state"
  : >"$state/removed"
  : >"$state/builder"
  : >"$state/log"
  env REMOVED="$state/removed" BUILDER="$state/builder" LOG="$state/log" PATH="$work/bin:$PATH" \
    AMPM_IMAGE="$2" previous_app="$3" STATE="$state" "${@:5}" \
    bash -c "set -euo pipefail; log() { printf '%s\n' \"\$*\" >>\"\$LOG\"; }; write_compose_env() { :; }; $block" ||
    status=$?
  local removed recorded builder
  removed="$(sort "$state/removed" | tr '\n' ' ' | sed 's/ $//')"
  recorded="$(cat "$state/app-image")"
  builder="$(cat "$state/builder")"
  if ((status == 0)); then ok "$1 carries on (exit 0)"; else bad "$1 exits $status, not 0"; fi
  if [[ "$removed" == "$4" ]]; then ok "$1 removes '${4:-nothing}'"; else bad "$1 removes '${removed:-nothing}', not '${4:-nothing}'"; fi
  if [[ "$recorded" == "$2" ]]; then ok "$1 records $2"; else bad "$1 records '$recorded', not $2"; fi
  if [[ "$builder" == "-f --max-used-space 8GB" ]]; then
    ok "$1 trims the build cache to 8 GiB, once"
  else
    bad "$1 runs 'docker builder prune' with '${builder:-nothing}', not once with '-f --max-used-space 8GB'"
  fi
}
# logged <case> <text>: the case's log holds the text.
logged() {
  if grep -qF -- "$2" "$work/$1/log"; then
    ok "$1 logs '$2'"
  else
    bad "$1 does not log '$2'"
    sed 's/^/     | /' "$work/$1/log" >&2
  fi
}

prune "a new release" ampm-prod-app:cccccccccccc ampm-prod-app:bbbbbbbbbbbb ampm-prod-app:aaaaaaaaaaaa
prune "a rerun of the same commit" ampm-prod-app:cccccccccccc ampm-prod-app:cccccccccccc ""
prune "a first deploy" ampm-prod-app:cccccccccccc "" ""
logged "a new release" "build cache trimmed to 8 GiB, least recently used first (Total reclaimed space: 0B)"
prune "a release whose build-cache prune fails" ampm-prod-app:cccccccccccc ampm-prod-app:bbbbbbbbbbbb \
  ampm-prod-app:aaaaaaaaaaaa STUB_PRUNE_ERROR="Error response from daemon: a prune operation is already running"
logged "a release whose build-cache prune fails" "WARNING: the build-cache prune failed"
logged "a release whose build-cache prune fails" "Error response from daemon: a prune operation is already running"

if ((failures > 0)); then
  echo "$failures redeploy-prod check(s) failed" >&2
  exit 1
fi
echo "all redeploy-prod checks passed"
