#!/usr/bin/env sh
# Capstone for the VPS block (feature 6.8): prove the full backup -> restore cycle end to end, the way the
# rebuild/restore runbooks will on the real box. It seeds a marker, takes a pgBackRest backup, writes a
# SECOND marker committed AFTER the backup and forces its WAL to the repo, then DESTROYS the PGDATA volume
# (keeping only the backup repository — a real "the database volume is gone" loss), restores from the repo
# with point-in-time recovery, brings Postgres back, and verifies BOTH markers survived. The second marker
# proves WAL replay (not just the base backup), which is what the ~1-minute recovery point depends on.
# It also measures and prints the recovery time (RTO). Needs a running Docker daemon.  POSIX sh.
set -eu

COMPOSE="docker compose -f infra/compose/local/compose.yml"
# Pin the project name so the volume we destroy below is deterministic even if the environment already
# sets COMPOSE_PROJECT_NAME (which would otherwise override the compose file's `name:`).
export COMPOSE_PROJECT_NAME=ampm-local
PGDATA_VOL="${COMPOSE_PROJECT_NAME}_pgdata" # compose names volumes <project>_<volume>

cleanup() {
	rc=$?
	$COMPOSE --profile restore down -v >/dev/null 2>&1 || true
	trap - EXIT
	exit "$rc"
}
trap cleanup EXIT

# psql as the ampm superuser over the socket; -At -q gives bare values.
pg() { $COMPOSE exec -T -e PGPASSWORD=ampm postgres psql -U ampm -d ampm -X -At -q -c "$1"; }

echo "smoke-restore: bring up postgres + pgbackrest"
$COMPOSE up -d --build --wait postgres pgbackrest

# A probe table (no app migrations needed — any data that must survive the cycle will do). Marker A is
# committed BEFORE the backup, so it rides in the base backup.
pg "CREATE TABLE IF NOT EXISTS restore_probe (marker text primary key, created_at timestamptz default now());" >/dev/null
pg "INSERT INTO restore_probe (marker) VALUES ('A');" >/dev/null
echo "smoke-restore: seeded marker A, taking the base backup"
$COMPOSE exec -T pgbackrest sh /usr/local/bin/scheduler.sh bootstrap >/dev/null

# Markers B and C are committed AFTER the backup, so they live only in the WAL. The PITR target sits
# BETWEEN them: recovering to it must bring back B (proving WAL replay) and must NOT bring back C (proving
# point-in-time precision). C also gives recovery a commit PAST the target, so it stops there and promotes
# cleanly instead of running to the end of the WAL and failing to reach the target.
pg "INSERT INTO restore_probe (marker) VALUES ('B');" >/dev/null
target=$(pg "SELECT clock_timestamp();") # after B's commit, before C's
sleep 1
pg "INSERT INTO restore_probe (marker) VALUES ('C');" >/dev/null
pg "SELECT pg_switch_wal();" >/dev/null

# Force B's and C's WAL all the way into the repo. archive-async means pg_stat_archiver can report
# "archived" while a segment is still only spooled, so rely on pgBackRest's own check: when `check` passes
# the archive is current (its test segment is later than C's, and WAL archives in order), so B+C are in the
# repo. Retry to absorb the async push.
archived=0
i=0
while [ "$i" -lt 30 ]; do
	if $COMPOSE exec -T pgbackrest pgbackrest --stanza=ampm check >/dev/null 2>&1; then
		archived=1
		break
	fi
	i=$((i + 1))
	sleep 2
done
[ "$archived" = 1 ] || { echo "smoke-restore FAILED: post-backup WAL never reached the repo (pgbackrest check)"; exit 1; }
echo "smoke-restore: backup done; B+C archived; PITR target (between B and C) = $target"

# --- Simulate catastrophic loss of the database volume (the backup repo survives) ---
echo "smoke-restore: DESTROYING the pgdata volume (keeping the backup repo)"
rto_start=$(date +%s)
$COMPOSE rm -sf postgres pgbackrest >/dev/null 2>&1
docker volume inspect "$PGDATA_VOL" >/dev/null 2>&1 || { echo "smoke-restore FAILED: expected volume $PGDATA_VOL not found (wrong project name?)"; exit 1; }
docker volume rm "$PGDATA_VOL" >/dev/null
# The pgdata volume is gone; the data is unrecoverable except from the backup.

# --- Restore from the repo into a fresh PGDATA, point-in-time to `target` ---
echo "smoke-restore: restoring from the backup repository (PITR)"
$COMPOSE --profile restore run --rm -e "RESTORE_TARGET_TIME=$target" restore >/dev/null

echo "smoke-restore: starting Postgres to replay WAL to the target and promote"
if ! $COMPOSE up -d --wait --wait-timeout 180 postgres; then
	echo "smoke-restore FAILED: Postgres did not become healthy after restore — recovery log:"
	$COMPOSE logs --tail=50 postgres 2>/dev/null || true
	exit 1
fi
# pg_isready answers during hot-standby recovery, so wait for actual PROMOTION before trusting the data.
i=0
while [ "$(pg 'SELECT pg_is_in_recovery()' 2>/dev/null)" != "f" ]; do
	i=$((i + 1))
	[ "$i" -ge 30 ] && { echo "smoke-restore FAILED: Postgres never promoted (still in recovery)"; $COMPOSE logs --tail=50 postgres 2>/dev/null || true; exit 1; }
	sleep 2
done
rto_end=$(date +%s)

# --- Verify: A (in the backup) and B (WAL before the target) survived; C (WAL after the target) did not ---
have_a=$(pg "SELECT count(*) FROM restore_probe WHERE marker = 'A';" 2>/dev/null || echo 0)
have_b=$(pg "SELECT count(*) FROM restore_probe WHERE marker = 'B';" 2>/dev/null || echo 0)
have_c=$(pg "SELECT count(*) FROM restore_probe WHERE marker = 'C';" 2>/dev/null || echo 0)
echo "smoke-restore: recovered A=$have_a B=$have_b C=$have_c (expect A=1 B=1 C=0)"
[ "$have_a" = "1" ] || { echo "smoke-restore FAILED: marker A (in the base backup) did not survive"; exit 1; }
[ "$have_b" = "1" ] || { echo "smoke-restore FAILED: marker B (WAL before the target) did not survive — WAL replay broken"; exit 1; }
[ "$have_c" = "0" ] || { echo "smoke-restore FAILED: marker C (WAL after the target) came back — PITR did not stop at the target"; exit 1; }

rto=$((rto_end - rto_start))
echo "smoke-restore OK: backup -> volume loss -> PITR restore. A+B recovered, C correctly excluded (point-in-time precise)."
echo "smoke-restore: measured RTO (volume destroy -> Postgres healthy) = ${rto}s; the post-backup commit before the target was recovered (system RPO bound = archive_timeout 60s)."
