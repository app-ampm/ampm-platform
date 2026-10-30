#!/usr/bin/env sh
# Local smoke for the container stack (features 6.1-6.3): build the images, bring the whole stack up, and
# prove it works end to end -- the Caddy edge serves /health 200 over HTTPS with the edge headers and the
# HTTP->HTTPS redirect, and pgBackRest takes an encrypted backup that passes `check` and records a
# job_runs row. Then tear everything down. Needs a running Docker daemon.
set -eu

COMPOSE="docker compose -f infra/compose/local/compose.yml"

# Preserve the real exit status: capture $? first and re-exit with it, so the teardown's own success does
# not mask a failed build/check (a false green here would ship broken infra through CI).
cleanup() {
	rc=$?
	$COMPOSE down -v >/dev/null 2>&1 || true
	trap - EXIT
	exit "$rc"
}
trap cleanup EXIT

$COMPOSE up -d --build --wait --wait-timeout 300

# --- the edge (feature 6.2) ---
# Caddy can briefly 502/503 while it establishes the upstream just after `up --wait` returns; retry the
# edge health check for up to ~60s so a startup race does not flake the smoke (a real outage still fails).
code=000
i=0
while [ "$i" -lt 30 ]; do
	code=$(curl -sSk -o /dev/null -w '%{http_code}' https://localhost:8443/health 2>/dev/null || echo 000)
	[ "$code" = "200" ] && break
	i=$((i + 1))
	sleep 2
done
echo "smoke: /health over HTTPS through Caddy -> HTTP $code"
[ "$code" = "200" ] || { echo "smoke FAILED: health $code"; exit 1; }

redirect=$(curl -sk -o /dev/null -w '%{http_code}' http://localhost:8080/health)
echo "smoke: http://:8080 -> $redirect (expect 308)"
[ "$redirect" = "308" ] || { echo "smoke FAILED: no HTTP->HTTPS redirect ($redirect)"; exit 1; }

headers=$(curl -fsSk -D - -o /dev/null https://localhost:8443/health)
for h in "x-content-type-options: *nosniff" "x-frame-options: *DENY" "referrer-policy:" "permissions-policy:"; do
	echo "$headers" | grep -iqE "^$h" || { echo "smoke FAILED: missing edge header matching '$h'"; exit 1; }
done
for h in "server:" "x-powered-by:"; do
	echo "$headers" | grep -iqE "^$h" && { echo "smoke FAILED: '$h' should be stripped at the edge"; exit 1; }
done
echo "smoke: edge OK (HTTPS + redirect + headers + server identity stripped)"

# --- backups (feature 6.3): migrate so job_runs exists, then run the real pgBackRest entrypoint once
# (scheduler.sh bootstrap: stanza-create + an initial full on the empty repo + check + job_runs record).
$COMPOSE exec -T -w /repo/apps/api api node /repo/node_modules/.bin/prisma migrate deploy >/dev/null
$COMPOSE exec -T pgbackrest sh /usr/local/bin/scheduler.sh bootstrap >/dev/null
row=$($COMPOSE exec -T -e PGPASSWORD=ampm postgres \
	psql -U ampm -d ampm -Atc "select status from job_runs where job_name='backup.pgbackrest' order by created_at desc limit 1;")
echo "smoke: pgbackrest bootstrap full backup + check -> job_runs status='$row'"
[ "$row" = "succeeded" ] || { echo "smoke FAILED: backup not recorded succeeded"; exit 1; }

echo "smoke OK: edge serves HTTPS with headers, and pgBackRest backs up + checks + records job_runs"
