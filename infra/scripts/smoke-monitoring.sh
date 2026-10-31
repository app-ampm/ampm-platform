#!/usr/bin/env sh
# Local runtime smoke for the monitoring stack (feature 6.7). The plain smoke.sh proves the app + edge +
# backups; this proves the observability wiring actually RUNS before the real box exists: Prometheus loads
# the alert rules, scrapes node-exporter, discovers Alertmanager, drives the blackbox job, and sees the
# db-metrics textfile end to end (Postgres -> collector -> node-exporter -> Prometheus). It brings up the
# `monitoring` profile of the local stack, queries Prometheus with promtool from INSIDE the container (so
# nothing is published), and tears everything down. Needs a running Docker daemon.
set -eu

COMPOSE="docker compose -f infra/compose/local/compose.yml --profile monitoring"
SECRETS_DIR="infra/compose/local/monitoring-secrets"
TARGETS_DIR="infra/compose/local/monitoring-targets"
EXPECTED_RULES=18

# A throwaway paging webhook so Alertmanager starts (url_file). Port 9 refuses connections — pages would
# fail fast, which is correct for a smoke. Gitignored; removed on teardown.
mkdir -p "$SECRETS_DIR"
printf 'http://127.0.0.1:9/\n' >"$SECRETS_DIR/webhook_url"
# The blackbox edge-probe target (deploy.sh renders this with the real domain on the VPS); here it points
# at the local caddy service, which smoke-monitoring does not start — the probe target being down is fine.
mkdir -p "$TARGETS_DIR"
printf -- '- targets: ["https://caddy/health"]\n' >"$TARGETS_DIR/edge.yml"

cleanup() {
	rc=$?
	$COMPOSE down -v >/dev/null 2>&1 || true
	rm -rf "$SECRETS_DIR" "$TARGETS_DIR"
	trap - EXIT
	exit "$rc"
}
trap cleanup EXIT

# Build the images FIRST, while nothing is running: the app build is memory-hungry, and building it next
# to a live Postgres can OOM Postgres into recovery mode on a constrained machine. Then bring up Postgres,
# the collector, and the monitoring stack (not caddy/api/worker — the collector reads the DB over the
# socket, and blackbox's probe target being down is fine here; we assert the wiring, not a live edge).
$COMPOSE build
$COMPOSE up -d --wait postgres db-metrics node-exporter prometheus alertmanager blackbox-exporter

# job_runs must exist or the collector's backup query fails every cycle; migrate it with the (already
# built) app image as a one-off, no deps (Postgres is already up). Retry a few times in case Postgres is
# still finishing startup when the first attempt connects.
i=0
until docker compose -f infra/compose/local/compose.yml run --rm --no-deps -T \
	-w /repo/apps/api api node /repo/node_modules/.bin/prisma migrate deploy >/dev/null 2>&1; do
	i=$((i + 1))
	[ "$i" -ge 5 ] && { echo "smoke-mon FAILED: prisma migrate deploy did not succeed after 5 tries"; exit 1; }
	echo "smoke-mon: migrate retry $i (Postgres still starting?)"
	sleep 5
done
echo "smoke-mon: migrated (job_runs exists)"

# Query Prometheus from inside its own container (promtool ships in the image); prints "<series> => <v> @[ts]".
pq() { $COMPOSE exec -T prometheus promtool query instant http://localhost:9090 "$1" 2>/dev/null; }
# The scalar value after "=>" (empty if the query returned no series).
pqval() { pq "$1" | sed -n 's/.*=> \([0-9.e+-]*\) .*/\1/p' | head -1; }

# Wait for the end-to-end path: the collector writes the textfile, node-exporter exposes it, Prometheus
# scrapes it (scrape_interval 30s). Poll up to ~150s for the collector heartbeat metric to appear.
echo "smoke-mon: waiting for the collector metric to reach Prometheus..."
i=0
hb=""
while [ "$i" -lt 30 ]; do
	hb=$(pqval 'ampm_collector_last_run_timestamp_seconds')
	[ -n "$hb" ] && break
	i=$((i + 1))
	sleep 5
done
[ -n "$hb" ] || {
	echo "smoke-mon FAILED: ampm_collector_last_run_timestamp_seconds never reached Prometheus (collector -> node-exporter -> scrape path)"
	$COMPOSE logs --tail=30 db-metrics prometheus node-exporter 2>/dev/null || true
	exit 1
}
echo "smoke-mon: collector textfile metric is in Prometheus (end-to-end path works)"

# The alert rules actually loaded in the running Prometheus (not just promtool-valid on disk).
rules=$(pqval 'sum(prometheus_rule_group_rules)')
echo "smoke-mon: Prometheus loaded ${rules:-0} rules (expect >= $EXPECTED_RULES)"
case "${rules:-0}" in *.*) rules=${rules%%.*} ;; esac # promtool may print 18 or 18.0
[ -n "$rules" ] && [ "$rules" -ge "$EXPECTED_RULES" ] || { echo "smoke-mon FAILED: expected >= $EXPECTED_RULES rules loaded, got '${rules:-0}'"; exit 1; }

# node-exporter is being scraped, and the blackbox job + its relabeling are wired (blackbox answers even
# when its probe target is down, so up{job=blackbox}=1 proves the scrape config, not the edge).
[ "$(pqval 'up{job="node"}')" = "1" ] || { echo "smoke-mon FAILED: node-exporter target is not up"; exit 1; }
[ "$(pqval 'up{job="blackbox"}')" = "1" ] || { echo "smoke-mon FAILED: blackbox job is not up (scrape/relabel wiring)"; exit 1; }
echo "smoke-mon: node + blackbox scrape targets are up"

# Prometheus found Alertmanager (the alerting wiring).
amd=$(pqval 'prometheus_notifications_alertmanagers_discovered')
[ -n "$amd" ] && [ "${amd%%.*}" -ge 1 ] || { echo "smoke-mon FAILED: Prometheus discovered no Alertmanager (got '${amd:-}')"; exit 1; }
echo "smoke-mon: Alertmanager discovered by Prometheus"

echo "smoke-mon OK: rules loaded, node+blackbox scraped, Alertmanager discovered, collector metric flows end to end"
