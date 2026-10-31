# Restore the database only (feature 6.8, D-056)

Use this when the data is bad — a wrong migration, a bad bulk operation, corruption — but the host and the
backup repository are fine. The box stays; only PGDATA is rolled back. Target: **under 1 hour**. If a
wedding is live, tell the project lead first and set the deploy freeze (the production deploy workflow is
already refused while `DEPLOY_FREEZE` is set, but a human should know).

To rebuild a lost box instead, use [rebuild.md](rebuild.md). The restore engine is
[`infra/pgbackrest/restore.sh`](../pgbackrest/restore.sh), run by the one-off `restore` compose service
(profile `restore`, PGDATA read-write); recovery itself (WAL replay) then happens in the `postgres` service.

## Steps (on the host, in the environment's compose directory)

```bash
cd /opt/ampm
COMPOSE="docker compose -f infra/compose/production/compose.yml"   # or staging

# 1. Decrypt secrets if the env files are not present (restore needs the repo cipher + S3 creds).
SOPS_AGE_KEY_FILE=/etc/ampm/age.key infra/scripts/decrypt-secrets.sh production

# 2. Quiesce writers so nothing writes during/after the restore.
$COMPOSE stop api worker

# 3. Stop Postgres — the restore replaces PGDATA, which the running server holds open.
$COMPOSE stop postgres pgbackrest

# 4. Restore. Latest (recover to the newest consistent point, ~1-minute recovery point):
$COMPOSE --profile restore run --rm restore
#    …or point-in-time (stop just before the bad change). Pick a time with activity on both sides of it:
$COMPOSE --profile restore run --rm -e "RESTORE_TARGET_TIME=2026-10-31 11:59:00+00" restore

# 5. Start Postgres; it replays WAL to the target (archive-get from the repo) and promotes. Wait for
#    PROMOTION, not just pg_isready (which answers during recovery, before the cluster is writable):
$COMPOSE up -d --wait postgres
until [ "$($COMPOSE exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U ampm -d ampm -Atqc "SELECT pg_is_in_recovery()"')" = f ]; do sleep 2; done

# 6. Verify the data (row counts, the record that was wrong). THEN bring the rest back with a bare `up`,
#    which restarts api, worker, caddy AND pgbackrest (step 3 stopped the backup sidecar too).
$COMPOSE up -d --wait
```

Clear the deploy freeze and tell the lead when verified.

## Notes

- **Point-in-time.** `RESTORE_TARGET_TIME` is any timestamp with an offset, e.g. `2026-10-31 11:59:00+00`.
  Recovery is inclusive and stops at the first commit after the target, then promotes. Choose a time just
  **before** the bad change; confirm there is a later commit so recovery reaches the target and promotes
  (if the target is past the end of the WAL, recovery cannot reach it).
- **`--delta`.** `restore.sh` restores with `--delta`, so it works whether PGDATA is empty (a rebuilt
  volume) or still holds the old cluster (an in-place roll-back).
- **Reachability.** Production reads the encrypted S3 repo over the `egress` network; the repo cipher pass
  and S3 keys come from `postgres.env` (sops). A wrong cipher pass or unreachable bucket fails loudly.
- **Rehearsal (AC-22).** Monthly, do this into **staging** with a chosen point-in-time, run the smoke
  tests, and record the measured recovery point and time in the vault. The mechanism is proven locally and
  in CI by [`infra/scripts/smoke-restore.sh`](../scripts/smoke-restore.sh) (back up → destroy the PGDATA
  volume → PITR restore → verify a post-backup commit survived and a later one was correctly excluded).
