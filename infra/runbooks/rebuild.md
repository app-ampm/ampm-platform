# Rebuild from nothing (feature 6.8, D-056)

Use this when the box is lost — hardware failure, a destroyed VPS, a region move. The server is rebuilt
entirely from this repository plus two things that are NOT in the repository: the **age private key** and
the **backup repository** (the encrypted S3 bucket in Mumbai, which survives the box). Target: **under 4
hours**; rehearsed quarterly (AC-22). If a wedding is live this is a declared incident — tell the lead.

Prerequisites: a fresh VPS (sizing in vps-setup §2), DNS access, the age key from the password manager,
and the S3 repo credentials (in the `postgres` secret zone).

## Steps

```bash
# 1. Provision + harden the host from code (feature 6.5). Run as root on the fresh box; idempotent.
#    Pass BOOTSTRAP_REPO_URL to clone the repo to /opt/ampm, or clone it by hand afterwards.
curl -fsSL <this-repo>/infra/bootstrap.sh | BOOTSTRAP_REPO_URL=<repo> bash   # see bootstrap.md
cd /opt/ampm

# 2. Place the age private key (from the password manager), mode 600, OUTSIDE the checkout.
install -m 600 /dev/stdin /etc/ampm/age.key    # paste the key, then Ctrl-D

# 3. Decrypt secrets for the environment (feature 6.4).
SOPS_AGE_KEY_FILE=/etc/ampm/age.key infra/scripts/decrypt-secrets.sh production
COMPOSE="docker compose -f infra/compose/production/compose.yml"

# 4. Restore PGDATA from the repo (latest, or point-in-time). The restore service reads the repo
#    directly, so Postgres must NOT be running yet (starting it first on the empty volume would initdb a
#    throwaway cluster and break stanza operations against the surviving repo). See restore.md.
$COMPOSE --profile restore run --rm restore          # or -e "RESTORE_TARGET_TIME=..."

# 5. Start Postgres; it replays WAL via archive-get and promotes. Wait for PROMOTION, not just pg_isready
#    (pg_isready answers during hot-standby recovery, before the cluster is writable):
$COMPOSE up -d --wait postgres
until [ "$($COMPOSE exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U ampm -d ampm -Atqc "SELECT pg_is_in_recovery()"')" = f ]; do sleep 2; done

# 6. Bring up the WHOLE stack with a bare `up` (the restore/migrate profiles stay excluded). This starts
#    redis, api, worker, caddy AND pgbackrest + the monitoring stack (node-exporter, blackbox, prometheus,
#    alertmanager, db-metrics). A named-service `up` would silently leave pgbackrest and monitoring down.
$COMPOSE up -d --wait

# 7. Point DNS at the new box (A/AAAA for the apex + app + staging). Caddy issues TLS on first request.

# 8. Smoke it: the edge serves /health over HTTPS, the app works, backups resume, alerts are armed.
```

Record the measured recovery **point** (how much data, if any, was lost — expected ≈ the last archived
WAL, ~1 minute) and recovery **time** (start of step 1 to smoke-green) in the vault.

## Notes

- **What is NOT in the repo:** the age private key (host + password manager) and the backup repository
  (S3). Everything else — the image, Compose, Caddy, Postgres/pgBackRest config, bootstrap, secrets
  ciphertext, monitoring, these runbooks — rebuilds from here. This is the deliberate exception to the
  architecture's "nothing hand-built on a server" (vps-setup intro): the server is built from code.
- **DNS + TLS:** Caddy's ACME needs ports 80/443 reachable and the domain resolving to the box; until DNS
  propagates it serves its internal cert. The `CertificateExpiringSoon` alert (monitoring.md) catches a
  renewal that never succeeds.
- **Deploys resume normally** after the rebuild — the box is back to being built-from-`main`; the next
  release is a tag (deploy.md).
- **Rehearsal (AC-22):** quarterly on a throwaway VPS, timed. The DB side of this runbook is proven every
  CI run by [`infra/scripts/smoke-restore.sh`](../scripts/smoke-restore.sh).
