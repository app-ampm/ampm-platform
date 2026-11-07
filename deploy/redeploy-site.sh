#!/usr/bin/env bash
# Rebuild and restart the public website (apps/web) on the test box; Apache serves it at
# https://site.ampmverse.com through the site's .htaccess (deploy/site-ampmverse/htaccess.example).
# Run ON the box, from the repo root, after shipping the source (the same `git archive` step as
# redeploy-box.sh; docs/engineering/test-deploy.md):  bash deploy/redeploy-site.sh
#
# Touches ONLY the web container (--no-deps): the API, worker, Postgres and Redis keep running.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

BASE="infra/compose/local/compose.yml"
# The box-only override defines the web service (its build args, the 127.0.0.1:7002 port, the
# hardening); deploy/app-ampmverse/compose.test-override.example.yml is the template.
OVR="infra/compose/local/compose.test-override.yml"
COMPOSE="docker compose -f ${BASE} -f ${OVR}"

if ! $COMPOSE config --services 2>/dev/null | grep -qx web; then
  echo "The box override ${OVR} defines no web service." >&2
  echo "Copy it from deploy/app-ampmverse/compose.test-override.example.yml first." >&2
  echo "STEP_FAILED=config"
  exit 9
fi

echo ">> [1/3] build the website image"
$COMPOSE build web || { echo "STEP_FAILED=build"; exit 10; }

echo ">> [2/3] recreate the website container"
$COMPOSE up -d --no-deps --wait --wait-timeout 180 web || { echo "STEP_FAILED=up"; exit 11; }

echo ">> [3/3] check the home page"
PORT="${AMPM_SITE_PORT:-7002}"
curl -fsS -o /dev/null -w "home page: HTTP %{http_code}\n" "http://127.0.0.1:${PORT}/" \
  || { echo "STEP_FAILED=check"; exit 12; }
echo "REDEPLOY_SITE_DONE_OK"
