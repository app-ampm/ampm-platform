---
paths:
  - "infra/**"
  - "**/docker-compose*.yml"
  - "**/compose*.yml"
  - "**/Dockerfile*"
  - ".github/workflows/**"
---
# Infrastructure rules (the dedicated VPS, decision D-015; specification in docs/engineering/vps-setup.md)

- The server is built from this repository: `infra/bootstrap.sh`, the Compose projects, the Caddyfile, the pgBackRest and PostgreSQL configuration, the encrypted secrets and the runbooks. Nothing is configured by hand on the host; if it was, it is written back here the same day.
- Images are pinned by tag and digest; containers run as non-root with read-only filesystems where possible, `no-new-privileges`, memory and CPU limits, healthchecks and `restart: unless-stopped`. Only Caddy publishes ports; PostgreSQL and Redis live on the internal network.
- Secrets only through `sops` with `age` (`infra/secrets/*.enc.yaml`), decrypted at deploy. Never a secret in an environment file, a Compose file, a workflow, a log or a test fixture.
- Backups are code: the pgBackRest configuration (WAL archive forced every minute, full weekly, differential daily, encrypted repository on the Mumbai bucket, retention two full sets and fourteen days) and the daily check job. A change to the backup design is a decision record.
- Files live in S3 in Mumbai (media bucket behind the content network; identity documents in the restricted bucket under their own key), never on the host's disk — **except** that for the current single-VPS deployment (D-106) media may live on a persistent, backed-up host volume (`STORAGE_PROVIDER=local` with `STORAGE_LOCAL_PERSISTENT=true` and `MEDIA_SIGNING_SECRET` set), signed by the same 15-minute links. The S3 path stays the target and supersedes it when AMPM moves off the single box. Identity documents are not covered by this interim exception and still require the restricted store.
- Deploys only through the workflow: build on main, deploy to staging on merge, deploy to production on a release tag, migration job before the new API starts, health gate, rollback by the previous tag. The workflow refuses to deploy to production while the configuration flag says a wedding is live.
- Migrations are expand-and-contract; a release is reversible by redeploying the previous image.
- Every host change that affects security (firewall, SSH, users, packages) goes through `bootstrap.sh` or an Ansible task, with a note in the vault.
- Monitoring thresholds live in `infra/monitoring/`; an alert that fires without a runbook step gets one added.
- The monthly restore rehearsal and the quarterly rebuild are recorded in the vault with the measured recovery point and time.
