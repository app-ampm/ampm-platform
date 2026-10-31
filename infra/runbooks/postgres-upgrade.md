# Upgrade PostgreSQL to a new major version (feature 6.8, D-056)

A major upgrade (e.g. 16 → 17) is a **planned maintenance window**, rehearsed on staging first. pgBackRest
backups are physical and version-specific, so a major upgrade is not a restore — it is a `pg_dump` /
`pg_restore` (logical) migration into a new cluster. Minor upgrades (16.x → 16.y) need none of this: bump
the base image tag in `infra/docker/postgres.Dockerfile`, rebuild, deploy; the data directory is
compatible.

The image is `infra/docker/postgres.Dockerfile` (`ARG POSTGRES_VERSION=16-bookworm` + pgBackRest). Changing
the major version here is a decision record (infra rule, D-015): note the version, the date, and the window.

## Major upgrade (logical dump + load)

Rehearse this on **staging** end to end before touching production.

```bash
cd /opt/ampm
COMPOSE="docker compose -f infra/compose/staging/compose.yml"   # production once rehearsed
# The dump is a PLAINTEXT copy of all data — keep it OUTSIDE the repo checkout (the secret scan +
# .gitignore do not cover an ad-hoc path), mode 0600, and shred it when done.
DUMP="/var/backups/ampm-upgrade-$(date +%F).sql"
install -m 600 /dev/null "$DUMP"

# 1. Freeze: set DEPLOY_FREEZE (see incident.md); quiesce writers.
$COMPOSE stop api worker

# 2. Take a fresh full backup on the OLD version first (a known-good fallback).
$COMPOSE exec pgbackrest sh /usr/local/bin/backup.sh full

# 3. Dump the whole cluster (globals + all databases). The password stays INSIDE the container (from
#    postgres.env), never on the host command line — so it is not in shell history or the process list.
$COMPOSE exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall -U ampm' > "$DUMP"

# 4. Bump ARG POSTGRES_VERSION in infra/docker/postgres.Dockerfile to the new major (commit it), rebuild
#    the image, and bring up a FRESH empty cluster (new PGDATA volume for the new version).
$COMPOSE down                      # keep volumes for now
docker volume rm ampm-staging_pgdata   # discard the old-version data dir (the dump holds the data)
#    (build + push the new image via the deploy pipeline, or `--build` locally)
$COMPOSE up -d --wait postgres

# 5. Load the dump into the new cluster.
$COMPOSE exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U ampm -d postgres' < "$DUMP"

# 6. Re-initialise backups on the new version. The repo still holds the old major's stanza, so UPGRADE it
#    (stanza-create refuses a version / system-id change); then take a fresh full on the new version.
$COMPOSE exec pgbackrest pgbackrest --stanza=ampm stanza-upgrade
$COMPOSE exec pgbackrest sh /usr/local/bin/backup.sh full

# 7. Bring the whole stack up; run the app's migration check + smoke; verify; unfreeze; shred the dump.
$COMPOSE up -d --wait
shred -u "$DUMP"
```

## Notes

- **Why not pg_upgrade in place / pgBackRest restore?** The pinned image bundles one Postgres major;
  pgBackRest restores a physical copy of that major only. A logical dump/load crosses majors cleanly and
  keeps the "rebuild from the image" model. The pre-upgrade full backup (step 2) is the fallback if the
  load fails — restore it (restore.md) onto the old image and retry.
- **The dump is a plaintext copy of all data** — it is written to `/var/backups` (OUTSIDE the repo
  checkout) at mode 0600 and `shred`-ded when done. Never place it inside the checkout; the CI secret scan
  and `.gitignore` do not cover an ad-hoc dump path. Prefer a tmpfs/ramdisk path when the dump fits, so it
  never touches persistent disk.
- **Downtime** spans steps 1–7; size the window from the staging rehearsal's timing. The recovery point is
  the dump instant (writers are stopped), so no committed data is lost.
- **Extensions / settings:** `pg_dumpall` carries roles and grants; re-check any server settings in
  `infra/postgres/postgresql.conf` that are version-sensitive before the production run.
