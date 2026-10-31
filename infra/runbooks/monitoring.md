# Monitoring and alerts runbook (feature 6.7, D-054)

The thresholds live as code in [`infra/monitoring/`](../monitoring/); every alert in
[`rules/alerts.yml`](../monitoring/rules/alerts.yml) carries a `runbook` annotation pointing at its section
below. An alert that fires without a step here is a bug (infra rule, D-015) — add the step.

## The stack

On each VPS environment (production, staging) the deploy brings up, alongside the app:

| Component             | Role                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- |
| **node-exporter**     | Host CPU / memory / disk / load, and the db-metrics textfile it re-exports             |
| **db-metrics**        | Writes backup age + WAL-archive health from Postgres into node-exporter's textfile dir |
| **blackbox-exporter** | In-box probe of the public edge: reachability, HTTP status, TLS cert expiry            |
| **Prometheus**        | Scrapes the above + the app's `/metrics`; evaluates the alert rules                    |
| **Alertmanager**      | Groups firing alerts and pages the developer over the sops-managed webhook             |

Each environment runs its own Prometheus + Alertmanager; the per-environment paging webhook decides how
loudly it pages, so staging and production never cross-fire. Prometheus and Alertmanager bind to
`127.0.0.1` only (nothing but Caddy faces the internet).

### Reach the UIs

They publish no public port. Tunnel in over SSH:

```bash
ssh -L 9090:localhost:9090 -L 9093:localhost:9093 <deploy-user>@<host>
```

Then open `http://localhost:9090` (Prometheus: targets, rules, graph) and `http://localhost:9093`
(Alertmanager: firing alerts, silences). For a quick CLI check without a tunnel:
`docker compose -f infra/compose/<env>/compose.yml exec prometheus promtool query instant http://localhost:9090 'ALERTS'`.

## Thresholds

| Signal           | Normal      | Wedding-day mode | Source                                  |
| ---------------- | ----------- | ---------------- | --------------------------------------- |
| Disk used        | 80%         | 70%              | node-exporter                           |
| Memory used      | 90%         | 80%              | node-exporter                           |
| CPU busy         | 90% for 15m | —                | node-exporter                           |
| Backup age       | 26h         | 13h              | db-metrics (job_runs)                   |
| WAL archive lag  | 10m         | 5m               | db-metrics (pg_stat_archiver)           |
| Cert expiry      | 14 days     | 21 days          | blackbox-exporter                       |
| Job failures     | >5 in 15m   | —                | app `/metrics` (ampm_jobs_failed_total) |
| Webhook failures | >0 in 15m   | —                | app `/metrics`                          |

## Wedding-day mode

While a project is live the app exposes `ampm_wedding_live == 1`, and the `Wedding*` rules re-check the
same signals at the tighter thresholds above. They are gated on the flag, so they stay silent whenever it
is 0 or absent. The app exposes the flag from the same configuration the deploy freeze reads (infra rule:
production forward-deploys are refused while a wedding is live). Until the app ships its `/metrics`
endpoint the flag is absent, so wedding-day rules (and the job/webhook rules) simply never fire.

A `Wedding*` alert means a project is live **and** a tightened threshold was crossed — treat it as urgent
and act before the event. Follow the matching normal-mode section below (disk, memory, backup, WAL, cert)
for the remediation; the only difference is the lower trigger and higher urgency.

## Host alerts

### NodeExporterDown

Prometheus cannot scrape node-exporter — the host is unmonitored. Check `docker compose -f
infra/compose/<env>/compose.yml ps node-exporter` and its logs; restart it. If the whole box is
unreachable, the external uptime monitor (below) is the backstop.

### HostDiskFillingUp

Disk over 80%. Find the consumer: `docker system df`, `du -xhd1 /var/lib/docker`, check WAL in the pgdata
volume and the journal (`journalctl --disk-usage`). Prune images (`docker image prune`), rotate/limit the
journal, and confirm WAL is shipping (see WALArchiveLagging — stuck archiving fills `pg_wal`).

### HostMemoryHigh

Memory over 90%. `docker stats`; the usual cause is Postgres under load or an app leak. Confirm Postgres
stays within its 6g (prod) / 3g (staging) limit; if the app is leaking, restart the api/worker and open an
issue. The OOM killer hitting Postgres is the risk this heads off.

### HostCPUSaturated

CPU over 90% for 15m. Look for a runaway query (`pg_stat_activity`, long-running statements) or a job
backlog (the worker). Not always actionable on its own; correlate with job failures and latency.

## Backup alerts

### BackupTooOld

No successful pgBackRest backup in over 26h — the recovery point is slipping. Check the pgbackrest service
logs and the most recent `job_runs` row (`job_name='backup.pgbackrest'`). Run one by hand:
`docker compose -f infra/compose/<env>/compose.yml exec pgbackrest sh /usr/local/bin/backup.sh diff`. See
[backups.md](backups.md) if present, and the pgBackRest config in [`infra/pgbackrest/`](../pgbackrest/).

### BackupMetricsMissing

No backup metric at all for 2h — either the db-metrics collector is down or no backup has ever succeeded.
Check `docker compose ... ps db-metrics` and its logs (it logs when a query fails), and that the pgbackrest
schedule has run at least once (a fresh deploy takes an initial full on first start).

### WALArchiveLagging

No WAL archived for over 10m — point-in-time recovery is frozen and `pg_wal` is growing toward a disk-full.
Check `pg_stat_archiver` (`last_failed_time`, `last_failed_wal`) and the Postgres log for `archive_command`
errors; usually the S3 repo is unreachable, the cipher pass is wrong, or credentials expired. Fix the repo
reachability; WAL drains once archiving resumes.

### WALArchiveFailing

`archive_command` is returning errors (pg_stat_archiver.failed_count rising). Same causes and fix as
WALArchiveLagging — repo auth, cipher, or S3 reachability. This fires sooner than the lag alert.

### MetricsCollectorStale

The db-metrics collector heartbeat stopped advancing for >5m, so the backup/archive metrics are stale and
must not be trusted (they may look fine only because they are frozen). Check `docker compose ... ps
db-metrics` and its logs; it skips a cycle whenever a query fails (DB down, auth), so this is the catch-all
"metrics are not fresh" signal. Restart it if wedged; investigate Postgres if its queries fail.

## Edge alerts

### EdgeProbeDown

The in-box blackbox probe of the edge has failed for 5m — Caddy or the API is not serving 200. Check
`docker compose ... ps caddy api` and their logs, and the app health (`/health`). Correlate with the
external uptime monitor to tell "edge down" from "this probe is broken".

### CertificateExpiringSoon

The edge cert expires in under 14 days — Caddy's ACME auto-renewal has been failing for weeks. Check the
Caddy logs for ACME errors (rate limits, DNS, port 80 reachability for HTTP-01). Confirm 80/443 are open
and the domain resolves to the box. Caddy renews automatically once the cause is fixed.

## App alerts

### JobFailuresHigh

Background job failures are elevated (`ampm_jobs_failed_total`). Check the worker logs and the `job_runs`
table for the failing job; most jobs are idempotent and retry. These rules activate once the app ships its
`/metrics` endpoint.

### WebhookFailuresHigh

Outbound webhook deliveries are failing (`ampm_webhook_failures_total`). Check the destination endpoint and
the worker logs; deliveries retry with backoff.

## External services (wired per environment)

These run off-box by design — an on-box monitor cannot page when the box itself is down.

- **Sentry** (api/worker/app errors): hosted. The api + worker read `SENTRY_DSN` from the app secret zone
  (see [`infra/secrets/examples/app.yaml`](../secrets/examples/app.yaml)); use a separate Sentry project
  per environment. The client Expo app reports with its OWN Sentry DSN, which is a public build-time value
  (not a backend secret), so it ships with the web/mobile build config, not this sops zone. Both the SDK
  wiring and the client DSN are a later app feature; the backend DSN seam is prepared here.
- **Uptime monitor** (pages the developer from outside): point an external monitor (UptimeRobot, Better
  Stack, Healthchecks.io, …) at the public website, the API `https://<domain>/health`, and staging. It is
  the backstop for NodeExporterDown / a dead box, and it independently validates the public TLS chain.
- **Log shipping** (journald SSH + sudo logs off-box): `bootstrap.sh` (feature 6.5) ships the host journal
  to `LOG_UPLOAD_URL` via `systemd-journal-upload`. Point it at a journal-remote receiver or a hosted log
  service; set `LOG_UPLOAD_URL` in the bootstrap environment. Until it is set, host logs stay on the box.

## Paging webhook (Alertmanager)

Alertmanager reads the paging URL from a file (`url_file`), produced from the sops `monitoring` zone by
`decrypt-secrets.sh`. To configure paging for an environment:

1. `cp infra/secrets/examples/monitoring.yaml infra/secrets/production.monitoring.yaml`, set
   `ALERT_WEBHOOK_URL` to the developer's paging webhook (Slack/Discord/PagerDuty/…).
2. Encrypt it: `sops infra/secrets/production.monitoring.yaml` → save as
   `infra/secrets/production.monitoring.enc.yaml` (see [secrets.md](secrets.md)).
3. Deploy. Without this zone the app still deploys and alerts still evaluate, but pages go to a placeholder
   that refuses connections (decrypt-secrets warns loudly) — paging is inert until it is set.

## Test an alert end to end

With a tunnel open, use Alertmanager's own test, or force a condition in a non-production environment (e.g.
stop node-exporter to trip NodeExporterDown after 5m). Confirm the alert shows in Prometheus
(`http://localhost:9090/alerts`), routes through Alertmanager (`http://localhost:9093`), and reaches the
webhook. The local `infra/scripts/smoke-monitoring.sh` proves the wiring (rules load, scrapes work,
Alertmanager is discovered, the collector metric flows) without a real box.
