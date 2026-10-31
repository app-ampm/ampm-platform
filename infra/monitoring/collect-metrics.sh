#!/usr/bin/env sh
# db-metrics collector (feature 6.7, D-054; vps-setup.md §7). Every COLLECT_INTERVAL seconds it queries
# Postgres for backup and WAL-archive health and writes them as node-exporter textfile metrics into the
# shared collector directory that node-exporter exposes. Backup freshness comes from the job_runs rows the
# pgBackRest backup records (the recorded-outcome model, D-047/D-050); WAL-archive lag comes from
# pg_stat_archiver. Runs as the db-metrics service (the postgres image, for psql + the Unix socket) in
# production/staging and the local `monitoring` profile. POSIX sh (dash/busybox): no bashisms.
#
# On ANY query failure the whole cycle is skipped — the previous .prom file AND the heartbeat are left
# untouched — so ampm_collector_last_run_timestamp_seconds stops advancing and MetricsCollectorStale
# fires. That is the single "these metrics are no longer fresh" signal, whatever the cause (Postgres down,
# auth, this container wedged). Writing is atomic (temp in the same dir, then mv) so node-exporter never
# reads a half-written file.
set -eu

INTERVAL="${COLLECT_INTERVAL:-60}"
OUT_DIR="${NODE_TEXTFILE_DIR:-/var/lib/node-metrics}"
OUT="$OUT_DIR/ampm.prom"

# Fail closed and loud if a required secret is missing (mirrors backup.sh): the socket is scram-only.
: "${PGPASSWORD:?PGPASSWORD is required so psql can authenticate to Postgres (pg_hba is scram-only)}"
: "${DATABASE_URL:?DATABASE_URL is required (the database name is its last path segment)}"
export PGPASSWORD
DB="${DATABASE_URL##*/}"
DB="${DB%%\?*}"

# -X ignores ~/.psqlrc; -A -t is unaligned + tuples-only (bare values); -q is quiet. Connects over the
# shared Unix socket as the ampm role, exactly as backup.sh does.
psql_q() { psql -h /var/run/postgresql -U ampm -d "$DB" -X -A -t -q -c "$1"; }

# Emit one metrics snapshot on stdout, or return non-zero (printing nothing committable) if any query
# fails so the caller skips the write.
collect() {
	archive_age=$(psql_q "SELECT coalesce(extract(epoch from now() - last_archived_time)::bigint, -1) FROM pg_stat_archiver") || return 1
	archived=$(psql_q "SELECT coalesce(archived_count, 0) FROM pg_stat_archiver") || return 1
	failed=$(psql_q "SELECT coalesce(failed_count, 0) FROM pg_stat_archiver") || return 1
	# One line per backup type: "<type> <epoch-of-newest-success>". GROUP BY is the type (not the
	# aggregate), so the concat of the group key with max(finished_at) is valid.
	backups=$(psql_q "SELECT coalesce(detail_json->>'type', 'unknown') || ' ' || coalesce(extract(epoch from max(finished_at))::bigint, 0)
	                    FROM job_runs
	                   WHERE job_name = 'backup.pgbackrest' AND status = 'succeeded'
	                   GROUP BY coalesce(detail_json->>'type', 'unknown')") || return 1
	now=$(psql_q "SELECT extract(epoch from now())::bigint") || return 1

	printf '# HELP ampm_pg_archive_age_seconds Seconds since the last WAL segment was archived (-1 = none yet).\n'
	printf '# TYPE ampm_pg_archive_age_seconds gauge\n'
	printf 'ampm_pg_archive_age_seconds %s\n' "$archive_age"
	printf '# HELP ampm_pg_archive_succeeded_total WAL segments archived (pg_stat_archiver.archived_count).\n'
	printf '# TYPE ampm_pg_archive_succeeded_total counter\n'
	printf 'ampm_pg_archive_succeeded_total %s\n' "$archived"
	printf '# HELP ampm_pg_archive_failed_total WAL archive failures (pg_stat_archiver.failed_count).\n'
	printf '# TYPE ampm_pg_archive_failed_total counter\n'
	printf 'ampm_pg_archive_failed_total %s\n' "$failed"
	printf '# HELP ampm_pgbackrest_last_backup_timestamp_seconds Unix time of the newest successful backup, by type.\n'
	printf '# TYPE ampm_pgbackrest_last_backup_timestamp_seconds gauge\n'
	echo "$backups" | while IFS=' ' read -r btype bepoch; do
		[ -n "$btype" ] || continue
		printf 'ampm_pgbackrest_last_backup_timestamp_seconds{type="%s"} %s\n' "$btype" "$bepoch"
	done
	printf '# HELP ampm_collector_last_run_timestamp_seconds Unix time this collector last wrote metrics.\n'
	printf '# TYPE ampm_collector_last_run_timestamp_seconds gauge\n'
	printf 'ampm_collector_last_run_timestamp_seconds %s\n' "$now"
}

echo "db-metrics: writing $OUT every ${INTERVAL}s"
while true; do
	tmp="$OUT.$$"
	if collect >"$tmp" 2>/dev/null; then
		chmod 0644 "$tmp"
		mv -f "$tmp" "$OUT"
	else
		rm -f "$tmp"
		echo "db-metrics: a query failed; keeping the previous snapshot (heartbeat will go stale -> MetricsCollectorStale)" >&2
	fi
	sleep "$INTERVAL"
done
