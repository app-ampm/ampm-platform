#!/usr/bin/env bash
# Redeploy the app.ampmverse.com test box's API + worker from the repo on the box, and re-seed.
# Run ON the box, from the repo root:  bash deploy/redeploy-box.sh
# (Get the latest source onto the box first; the box checkout has no git remote of its own, so ship it
#  with `git archive HEAD -- . ':(exclude)graphify-out' | ssh <box> 'cd <repo-on-box> && tar -xf -'`
#  from a clean worktree, and record the commit in the box's .deployed-commit.)
#
# NON-DESTRUCTIVE: `migrate deploy` (not reset) applies any pending migrations, and the seed upserts by
# fixed id (it never resets an enquiry's status), so data a tester has already driven forward is kept.
# Recreates ONLY api+worker (--no-deps), leaving Postgres/Redis up so they never hit the startup
# "recovery mode" race. For a clean wipe (schema/DB inconsistent) run, instead of steps [3]-[4]:
#   $COMPOSE exec -T -w /repo/apps/api api node /repo/node_modules/.bin/prisma migrate reset --force
#   $COMPOSE exec -T -w /repo/apps/api api node --import tsx prisma/seed.ts
# Prisma 7 note: `migrate reset` no longer takes --skip-generate/--skip-seed and does not auto-run the
# config seed, so migrations and the seed are explicit steps here.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="infra/compose/local/compose.yml"
# The box keeps its own override here — it publishes the API on 127.0.0.1:7001 and sets
# CORS_ORIGINS / WEB_APP_URL / TRUST_PROXY for the public origin. It is box-specific and not committed;
# deploy/app-ampmverse/compose.test-override.example.yml is the template to copy onto the box.
OVR="infra/compose/local/compose.test-override.yml"
COMPOSE="docker compose -f ${BASE} -f ${OVR}"

echo ">> [1/5] build api + worker images"
$COMPOSE build api worker || { echo "STEP_FAILED=build"; exit 10; }

echo ">> [2/5] recreate api + worker, leaving postgres/redis up"
$COMPOSE up -d --no-deps --wait --wait-timeout 300 api worker || { echo "STEP_FAILED=up"; exit 11; }

echo ">> [3/5] apply any pending migrations"
$COMPOSE exec -T -w /repo/apps/api api node /repo/node_modules/.bin/prisma migrate deploy || { echo "STEP_FAILED=migrate"; exit 12; }

echo ">> [4/5] re-seed demo data (idempotent upserts; adds any new seeded accounts/enquiries)"
$COMPOSE exec -T -w /repo/apps/api api node --import tsx prisma/seed.ts || { echo "STEP_FAILED=seed"; exit 13; }

echo ">> [5/5] health check"
PORT="${AMPM_TEST_PORT:-7001}"
curl -fsS "http://127.0.0.1:${PORT}/health" && echo "" && echo "REDEPLOY_DONE_OK"
