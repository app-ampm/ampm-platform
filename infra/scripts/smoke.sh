#!/usr/bin/env sh
# Local smoke for the container stack (feature 6.1): build the image, bring the whole stack up, assert
# GET /health returns 200 through Caddy, then tear down whatever happened. A repeatable proof the
# deploy artifact builds and runs, for a developer or CI. Needs a running Docker daemon.
set -eu

COMPOSE="docker compose -f infra/compose/local/compose.yml"

cleanup() { $COMPOSE down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

$COMPOSE up -d --build --wait --wait-timeout 180
code=$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:8080/health)
echo "smoke: /health through Caddy -> HTTP $code"
[ "$code" = "200" ] || { echo "smoke FAILED"; exit 1; }
echo "smoke OK"
