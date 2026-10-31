#!/usr/bin/env sh
# pgBackRest restore for the AMPM stanza (feature 6.8, D-056; vps-setup.md §4/§6). Restores PGDATA from the
# repository — the latest backup, or point-in-time to RESTORE_TARGET_TIME — so Postgres can start, replay
# WAL to that point, and promote. It is the engine of the restore-the-database-only and rebuild-from-nothing
# runbooks, and of the rehearsed restore (smoke-restore.sh).
#
# Runs in a ONE-OFF container (the `restore` compose service, profile: restore) that mounts PGDATA
# read-WRITE — unlike the pgbackrest sidecar, which mounts it read-only for backups. Postgres MUST be
# stopped while this runs (the restore writes PGDATA); the caller stops it, runs this, then starts it.
# POSIX sh (dash/busybox): no bashisms.
#
#   restore.sh                          restore the latest backup (recover to the end of the archived WAL)
#   RESTORE_TARGET_TIME="2026-10-31 12:00:00+00" restore.sh   point-in-time recovery to that instant
set -eu

STANZA=ampm
TARGET_TIME="${RESTORE_TARGET_TIME:-}"

# Fail closed and loud if the repo passphrase is missing: a restore cannot read the encrypted repository
# without it, and silently "succeeding" against the wrong or missing repo would be worse than crashing.
: "${PGBACKREST_REPO1_CIPHER_PASS:?PGBACKREST_REPO1_CIPHER_PASS is required (the repository is always encrypted)}"

# --delta: restore by comparing against whatever is already in PGDATA and only replacing what differs, so
# the command works whether PGDATA is empty (a fresh/rebuilt volume) or still holds the old cluster. It is
# the safe default for both the rebuild (empty) and the restore-in-place (non-empty) paths.
set -- --stanza="$STANZA" --delta

if [ -n "$TARGET_TIME" ]; then
	# Point-in-time recovery: stop replay at TARGET_TIME and promote (so the cluster opens read-write at
	# exactly that instant). Without a target, pgBackRest recovers to the end of the archived WAL — the most
	# recent consistent point, i.e. the ~1-minute recovery point the archive_timeout guarantees.
	set -- "$@" --type=time "--target=$TARGET_TIME" --target-action=promote
	echo "restore: point-in-time recovery to '$TARGET_TIME'"
else
	echo "restore: recovering to the latest archived WAL (newest consistent point)"
fi

if ! pgbackrest "$@" restore; then
	echo "restore: pgBackRest restore FAILED (repo reachable? cipher pass correct? PGDATA writable?)" >&2
	exit 1
fi

echo "restore: PGDATA restored — start Postgres to replay WAL and promote, then verify before use"
