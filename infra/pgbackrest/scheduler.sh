#!/usr/bin/env sh
# pgBackRest schedule for the AMPM stanza (vps-setup.md §4, D-050, infra rule D-015): a full backup on
# Sundays and a differential on the other days, each at ~03:00 UTC, with a repository check after every
# backup (backup.sh runs `check`). On start it ensures the stanza exists (so Postgres's archive-push has a
# target immediately) and takes an initial full if the repo is empty (so a fresh deploy is restorable at
# once, not only after the first 03:00). Used by the pgbackrest service in production/staging; locally the
# service idles and the smoke runs `scheduler.sh bootstrap`.  Run under /bin/sh (dash/busybox): no bashisms.
#   scheduler.sh            bootstrap, then loop forever (the production entrypoint)
#   scheduler.sh bootstrap  bootstrap, then exit 0 (one-shot: the local smoke / a manual first run)
set -eu

TARGET_HOUR="${BACKUP_HOUR_UTC:-3}"
MODE="${1:-run}"

# Fail closed and loud if a required secret is missing (e.g. the sops env did not decrypt): crash-loop
# visibly rather than silently never backing up. These are exactly the vars whose absence would otherwise
# let archiving break quietly until the WAL disk fills.
: "${PGPASSWORD:?PGPASSWORD is required so pgBackRest can authenticate to Postgres (pg_hba is scram-only)}"
: "${PGBACKREST_REPO1_CIPHER_PASS:?PGBACKREST_REPO1_CIPHER_PASS is required (the repository is always encrypted)}"

bootstrap() {
	# Idempotent; exits 0 if the stanza already exists. A real failure (auth/cipher/repo) must be loud, not
	# swallowed — it is the earliest signal that the backup setup is broken.
	if ! pgbackrest --stanza=ampm stanza-create; then
		echo "scheduler: stanza-create failed (auth / cipher / repo?) — backups cannot run" >&2
		exit 1
	fi
	# WAL alone is not restorable, so a fresh deploy needs a base backup now, not up to ~24h later. Only
	# when the repo has no backup yet, so a restart does not keep taking fulls; `|| true` so a transient
	# failure does not kill the scheduler (it is recorded to job_runs + logged).
	if pgbackrest --stanza=ampm info --output=json 2>/dev/null | grep -q '"backup":\[\]'; then
		echo "scheduler: no backup in the repo yet — taking an initial full"
		sh /usr/local/bin/backup.sh full || true
	fi
}

bootstrap
[ "$MODE" = bootstrap ] && exit 0

while true; do
	# Seconds until the next TARGET_HOUR:00:00 UTC. Strip the leading zero (08/09 are invalid octal in
	# POSIX arithmetic) with ${x#0}, which drops at most one 0 -> "09"->"9", "00"->"0", "23"->"23".
	h=$(date -u +%H)
	h=${h#0}
	m=$(date -u +%M)
	m=${m#0}
	s=$(date -u +%S)
	s=${s#0}
	secs=$(((((TARGET_HOUR - h + 24) % 24) * 3600) - (m * 60) - s))
	[ "$secs" -le 0 ] && secs=$((secs + 86400))
	sleep "$secs"

	# A failed night is recorded to job_runs and logged (monitoring alerts, feature 6.7); it must not
	# kill the scheduler, or every later night would be missed too.
	if [ "$(date -u +%u)" = 7 ]; then
		sh /usr/local/bin/backup.sh full || true
	else
		sh /usr/local/bin/backup.sh diff || true
	fi
done
