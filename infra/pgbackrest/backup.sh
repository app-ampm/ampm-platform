#!/usr/bin/env sh
# pgBackRest backup + check for the AMPM stanza (feature 6.3, D-050). Ensures the stanza exists, backs up
# at the requested type, verifies the repository, and records the outcome on the job_runs table (the
# shared recorded-outcome model, D-047). The pgBackRest container owns backups and records its own
# result, because the Node app cannot run pgBackRest and must not hold PGDATA. The repo backend (posix
# locally, encrypted S3 in production) comes from the PGBACKREST_* env.  Usage: backup.sh [full|diff|incr]
set -eu

STANZA=ampm
TYPE="${1:-diff}"

# TYPE is interpolated into SQL below, so it must be one of a fixed set — never arbitrary text (a stray
# quote would break or inject the job_runs INSERT). Validate before any SQL or pgBackRest call.
case "$TYPE" in
	full | diff | incr) ;;
	*)
		echo "usage: backup.sh [full|diff|incr]" >&2
		exit 2
		;;
esac

# Fail closed and loud if a required secret is missing (e.g. the sops env did not decrypt): far better to
# crash visibly than to run a backup to an unencrypted/unauthenticated target or skip it silently.
: "${PGPASSWORD:?PGPASSWORD is required so pgBackRest can authenticate to Postgres (pg_hba is scram-only)}"
: "${PGBACKREST_REPO1_CIPHER_PASS:?PGBACKREST_REPO1_CIPHER_PASS is required (the repository is always encrypted)}"

# One key per day + type, mirroring the app's dailyKey idiom (demo-restore.service.ts): a retry of the
# same night's backup reuses it, so the attempts correlate on the job_runs table.
KEY="backup.pgbackrest:$(date -u +%F):$TYPE"
RUN_ID=""

# Open a job_runs row in the `running` state (the schema's default) and keep its id. If the backup is then
# killed mid-run (OOM, reboot), the row stays `running` forever — a durable, queryable trace that the run
# started and never finished, which a single terminal-only row could not provide. id is gen_random_uuid()
# (UUID v4): unlike the app's v7 ids this is not time-ordered, but job_runs is ordered by created_at, so it
# is harmless; PG16 has no built-in uuidv7() and the sidecar has no app/Prisma path. Recording failures are
# logged loudly but never abort the backup — the backup matters more than its audit row.
start_run() {
	RUN_ID=$(psql "$DATABASE_URL" -X -At -q -c \
		"INSERT INTO job_runs (id, job_name, idempotency_key, status, started_at, created_at)
		 VALUES (gen_random_uuid(), 'backup.pgbackrest', '$KEY', 'running', now(), now())
		 RETURNING id" 2>/dev/null) || RUN_ID=""
	[ -n "$RUN_ID" ] || echo "WARN: could not open a job_runs row for this backup (recording only)" >&2
}

finish_run() { # $1 = succeeded|failed   $2 = error text ("" for none)
	[ -n "$RUN_ID" ] || {
		echo "WARN: no job_runs row to mark $1 (recording only)" >&2
		return 0
	}
	errsql="NULL"
	[ -n "$2" ] && errsql="'$2'"
	psql "$DATABASE_URL" -X -q -c \
		"UPDATE job_runs
		    SET status = '$1', detail_json = jsonb_build_object('type', '$TYPE'),
		        error = $errsql, finished_at = now()
		  WHERE id = '$RUN_ID'" \
		|| echo "WARN: could not mark the job_runs row $1 (recording only)" >&2
}

# stanza-create is idempotent and exits 0 when the stanza already exists; a non-zero here is a REAL problem
# (auth, cipher mismatch, unreachable repo), so surface it instead of hiding it.
if ! pgbackrest --stanza="$STANZA" stanza-create; then
	echo "pgbackrest: stanza-create failed for $STANZA (auth / cipher / repo?)" >&2
	exit 1
fi

start_run
if pgbackrest --stanza="$STANZA" backup --type="$TYPE" && pgbackrest --stanza="$STANZA" check; then
	finish_run succeeded ""
	echo "pgbackrest: $TYPE backup + check OK"
else
	finish_run failed "pgbackrest $TYPE backup or check failed"
	echo "pgbackrest: $TYPE backup/check FAILED" >&2
	exit 1
fi
