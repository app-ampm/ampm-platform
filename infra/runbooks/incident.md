# Incident response (feature 6.8, D-056)

Triggered by a page — the external uptime monitor, Sentry, or Alertmanager (feature 6.7). The job is to
triage fast, route to the right runbook, and keep the project lead informed when a wedding is live.

## First, if a wedding is live

Tell the project lead immediately and set the deploy freeze so no release lands mid-event:

```bash
# DEPLOY_FREEZE is a variable on the production GitHub Environment; the deploy workflow refuses forward
# production deploys while it is set (a rollback is still allowed — see deploy.md). Clear it after the event.
gh variable set DEPLOY_FREEZE --env production --body true   # freeze
gh variable set DEPLOY_FREEZE --env production --body ""     # clear (after the event)
```

## Triage (SSH to the box, `cd /opt/ampm`)

```bash
COMPOSE="docker compose -f infra/compose/production/compose.yml"
$COMPOSE ps                       # which containers are up / unhealthy / restarting
$COMPOSE logs --tail=100 caddy api worker postgres   # recent errors
df -h /; free -m                  # disk / memory pressure (also HostDiskFillingUp / HostMemoryHigh alerts)
```

For a specific alert, open [monitoring.md](monitoring.md) and follow that alert's section (every alert
names its runbook step). Reach Prometheus/Alertmanager over an SSH tunnel (`ssh -L 9090:localhost:9090 -L
9093:localhost:9093 …`) to see what is firing and silence noise.

## Route

| Symptom                                           | Action                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| A container is down/unhealthy                     | Check its logs; `$COMPOSE up -d --wait <svc>`; fix the cause                |
| Edge down / TLS failing (`EdgeProbeDown`, cert)   | Caddy logs; ports 80/443 open; DNS resolves; [monitoring.md](monitoring.md) |
| Disk/memory pressure                              | monitoring.md (HostDiskFillingUp / HostMemoryHigh): prune, free WAL         |
| WAL archiving stuck (`WALArchiveLagging/Failing`) | monitoring.md: S3 reachability, repo cipher/creds — PITR window at risk     |
| Data is wrong/corrupt, box is fine                | [restore.md](restore.md) (restore the DB, point-in-time)                    |
| The box is lost                                   | [rebuild.md](rebuild.md) (rebuild from nothing, target 4h)                  |
| A bad release                                     | [deploy.md](deploy.md): roll back by redeploying the previous tag           |

## After

- If anything was changed on the box by hand to recover, write it back into `infra/` the same day
  (infra rule, D-015) — the server must stay rebuildable from code.
- Record a short note in the vault: what happened, the signal that caught it (or did not), and any
  follow-up. If an alert was missing, add it + a runbook step (monitoring.md).
