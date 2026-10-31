# AMPM VPS runbooks (feature 6.8, D-056)

The server is built from this repository (`infra/`), not by hand (infra rule, D-015). These runbooks are
what the operator keeps to; each is backed by code in `infra/` so a rehearsal that touches the box by hand
is written back the same day.

| Runbook                                    | When                                                      |
| ------------------------------------------ | --------------------------------------------------------- |
| [rebuild.md](rebuild.md)                   | The box is lost — rebuild from nothing on a fresh VPS     |
| [restore.md](restore.md)                   | The data is bad but the box is fine — restore the DB only |
| [deploy.md](deploy.md)                     | Ship a release, or roll one back (feature 6.6)            |
| [secrets.md](secrets.md)                   | Create, rotate or decrypt a secret (feature 6.4)          |
| [bootstrap.md](bootstrap.md)               | Provision/harden a host (feature 6.5)                     |
| [monitoring.md](monitoring.md)             | An alert fired — per-alert steps (feature 6.7)            |
| [incident.md](incident.md)                 | A page or outage — triage and route to the runbook above  |
| [postgres-upgrade.md](postgres-upgrade.md) | Upgrade PostgreSQL to a new major version                 |

## Recovery objectives (D-015, vps-setup §4)

| Objective                          | Target    | How it is met                                                           |
| ---------------------------------- | --------- | ----------------------------------------------------------------------- |
| Recovery **point** (max data loss) | ~1 minute | pgBackRest forces a WAL archive every 60s (`archive_timeout`)           |
| Restore the DB only (**time**)     | < 1 hour  | [restore.md](restore.md): the `restore` compose service, PITR or latest |
| Rebuild from nothing (**time**)    | < 4 hours | [rebuild.md](rebuild.md): bootstrap → secrets → restore → up → DNS      |

## Rehearsal (AC-22)

- **Monthly:** restore the latest backup into **staging** with point-in-time recovery to a chosen minute,
  run the smoke tests, and record the measured recovery **point** and **time** in the vault (a dated note).
- **Quarterly:** run [rebuild.md](rebuild.md) on a fresh VPS, timed; record the same figures.
- The restore target (< 1 h) is met if the monthly figure stays under it; the rebuild target (< 4 h) if
  the quarterly figure does; the recovery point (~1 min) is confirmed by both drills.

The backup → restore mechanism itself is proven locally and in CI by
[`infra/scripts/smoke-restore.sh`](../scripts/smoke-restore.sh): it backs up, DESTROYS the PGDATA volume
(keeping only the repo), restores with PITR, and verifies a post-backup commit survived (WAL replay). The
real-box RPO/RTO figures are recorded in the vault once the VPS exists (the drill then repeats on the
cadence above).
