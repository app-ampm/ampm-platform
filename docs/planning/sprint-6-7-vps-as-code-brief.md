# Sprints 6–7 feature brief — the VPS as code

**For:** the development session (one developer + Claude Code) · **Date:** 29 October 2026 · **Status:** draft brief, awaiting the go before any code · **Phase:** build-plan Phase 1 (Foundation), the infrastructure block that follows the kernel (sprints 3–5, done) and precedes CRM & subscription (sprints 8–10).

This is a sprint brief, not a feature brief: it sets the goal for the two-sprint block and holds one mini-brief per feature, each built with the method in [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md). Build the features **in the order below**. The source of truth is [`docs/engineering/vps-setup.md`](../engineering/vps-setup.md) (R13 / D-015, locked); the enforceable rules are [`.claude/rules/infra.md`](../../.claude/rules/infra.md). Grounded in a survey of the current repository.

---

## 1. Where we start

- **Decided and locked (26 October 2026):** R13 / D-015 — everything on AMPM's dedicated **Hostinger KVM 4 in Mumbai** (4 vCPU, 16 GB, 200 GB NVMe), with pgBackRest archives to an **S3 bucket in Mumbai** and rehearsed restores; identity is Amazon Cognito in Mumbai; files live in S3 (media bucket behind a content network, identity documents in a restricted bucket under their own key), never on the box. The architecture's "nothing hand-built on a server" is set aside deliberately: the server is built from `infra/` in this repository and rebuilt from it.
- **Already in the repo:** `.github/workflows/ci.yml` (install → `db:generate` → `format:check` → `pnpm check` with a disposable PostgreSQL → matrix-drift gate → `build web,api` → mobile bundles) and `monday-sync.yml`. The app is container-ready in spirit — a 12-factor `env.ts`, a worker entry point, the inline↔BullMQ job seam (D-031), the session reaper and the new `job_runs` recorded-outcome model (D-047) — but there is **no `infra/` directory, no Dockerfile, no Compose file, no Caddyfile, and no deploy workflow yet.** This block builds all of it.
- **Everything is still local:** native PostgreSQL 16, optional local Redis, the local identity adapter, synthetic seed. The VPS **is not purchased yet** and host/SSH access comes later (vps-setup §0); until then `infra/` is developed and validated against **local Docker Compose and a local virtual machine**, not the real box.
- **Note on the source doc:** `vps-setup.md` is v0.1 and still says "what sprint 2 builds"; the locked execution plan ([build-plan.md](../review/build-plan.md) §3) moved this to **sprints 6–7**. The brief follows the build plan; bump the doc's status line as part of feature 6.1.

## 2. Decisions to settle first (do this before any code)

Each is a build-decision record (`python3 docs/tools/new_decision.py "…" --area infra`, `AMPM_VAULT` set in a worktree). The container image, the deploy workflow, `sops` and the backup design are each a **new pattern or dependency category**, so they are recorded before the code (code.md). The ones marked **(AMPM / R15)** also need an external input and gate only the *live* path.

1. **Local validation target** — how `infra/` is developed and tested before host access. **Recommend:** local Docker Compose on the dev machine for the stack, plus a throwaway local VM (Lima / Multipass / UTM) to run `bootstrap.sh` and rehearse the rebuild. Decide the VM tool and pin it. This is what makes the block shippable with no VPS.
2. **Image and registry** — a single image for `api` and `worker` (same code, different command), multi-stage build on the Node 24 base, built to the **GitHub Container Registry**; pinned by **tag and digest** (infra.md). Confirm GHCR vs an alternative, and the tag scheme (git SHA for staging, semver release tag for production).
3. **Secrets tooling** — `sops` + `age` (locked by vps-setup §3 / infra.md): `infra/secrets/*.enc.yaml`, decrypted on the host at deploy, the age key only on the host and in the developer's password manager. Record the secret registry (every secret and where it is used) and the key-custody/rotation process. A new dependency category → D-record.
4. **Staging topology** — a second Compose project on the same KVM 4 during the build, own database, own domain, smaller limits (vps-setup §1–2), moving to a small second VPS only if memory or disk pass 80 %. Confirm "same box during the build".
5. **The deploy-freeze flag** — the "a wedding is live" switch the deploy workflow must check before a production deploy (infra.md). **Recommend:** a `configurations` row read through `ConfigService` (the one typed accessor), exposed to the workflow by a tiny read (an API health/stat field or a `pnpm` script), not a hand-set repository variable. Decide where it lives and how the workflow reads it.
6. **Content network (CDN) in front of media** **(AMPM / R15)** — provider for the media bucket's edge (build-plan Phase 1 lists it); the identity-document bucket is never behind a public edge. Seam/config now; the account is external.
7. **(AMPM / R15) external, gating the live path only:** the VPS purchase with the **Mumbai** datacentre selected; the S3 Mumbai buckets (backup, media, restricted identity) and their keys; the domain + email authentication (due ~sprint 6); the Sentry and uptime-monitor accounts; the age key custody; root/SSH access to the host.

## 3. Sprint goal and exit

**Goal.** The VPS fully described as code in `infra/` and validated locally, so that when the box and the accounts open, going live is **running the workflow, not hand-building a server**. Every piece the build plan names — the Compose stack with hardening, `sops` secrets, pgBackRest with its schedule and the daily check job, the Mumbai buckets wiring, outside monitoring and alerts, a content network in front of media, CI to staging and tagged production deploys — exists and is exercised against local Compose and a local VM, with the live endpoints gated on the external accounts.

**Exit (all green under the block's own checks):**
- `docker compose config` valid for production and staging; `docker compose up` brings the whole stack healthy locally (Caddy → api/worker → postgres/redis on the internal network, only Caddy publishing) and a smoke test passes (`/health`, a signed-URL round-trip against a local S3 such as MinIO or LocalStack, a WebSocket connect).
- `bootstrap.sh` runs clean on a fresh local VM (shellcheck green; idempotent on a second run); `caddy validate` passes the Caddyfile; the pgBackRest and PostgreSQL configs validate.
- `deploy.yml` builds the image to GHCR on a branch, and a **dry-run / local-target** deploy performs the migration job → health gate → rollback path end to end; the production job refuses to run while the deploy-freeze flag is set.
- No secret in plaintext anywhere (a scan passes); every secret is in `infra/secrets/*.enc.yaml` with a registry entry.
- The **rebuild runbook is rehearsed once end to end** against a local VM (restore from a pgBackRest repo to a point in time, stack up, smoke green), and the measured recovery point and time are recorded in the vault (the AC-22 drill, done locally this block and on the real box once it exists).
- Every new pattern/dependency carries a D-record; **no external account blocks the sprint** — local Compose + local VM + a local S3 stand in, with live paths gated until AMPM opens the accounts.

## 4. Before any code

- Settle §2's decisions and record them. Flag every new dependency category (Docker/Compose, `sops`+`age`, the local S3 emulator, the deploy action) as a build-decision per `.claude/rules/code.md`.
- The kernel's "tests beside the code" maps to infra as **validators + a local smoke + a rehearsal**, not Vitest: `docker compose config`, `caddy validate`, `shellcheck`, `pgbackrest` config checks, a scripted local `compose up` smoke, and the rebuild rehearsal. Add these as `pnpm` scripts and a CI job so they run on every change (the hook/`pnpm check` discipline still holds for any TypeScript touched).
- `graphify query` / `explain` before grepping; read `.claude/rules/{infra,security,data,code}.md` and `docs/engineering/vps-setup.md` in full.

## 5. The features, in order

### 6.1 Container images + the local Compose stack
A multi-stage **Dockerfile** producing one pinned image that runs `api` (REST + WebSocket) or `worker` (jobs, webhooks, retention proposals) by command. `infra/compose/production/compose.yml` and `infra/compose/staging/compose.yml`: `caddy`, `api`, `worker`, `postgres`, `redis`, `pgbackrest`, `node-exporter`; image tags **and digests**; healthchecks; `restart: unless-stopped`; memory/CPU limits (postgres 6 GB, api 2 GB, worker 1 GB, staging 3 GB); read-only root filesystems where possible; non-root users; `no-new-privileges`; `postgres`/`redis` on an internal network, **only Caddy publishes ports**. Validated by `docker compose config` + a local `up` smoke. Also bump `vps-setup.md`'s stale "sprint 2" status line.

### 6.2 Caddy edge
`infra/caddy/Caddyfile`: domains, automatic TLS, HSTS, the security headers, **edge rate limits on sign-in, OTP and public forms**, the static public site, and a reverse proxy to the API with WebSocket support. This is the edge layer that sits in front of the app's own rate limiter and CSP (feature 5.4) — defence in depth, not a replacement. `caddy validate` in CI; the local smoke exercises a proxied request and a WS upgrade.

### 6.3 Data layer as code: PostgreSQL config + pgBackRest
`infra/postgres/` (`postgresql.conf` tuned to the box — shared buffers ~¼ memory, WAL level `replica`, the archive command to pgBackRest, logging — and an internal-only `pg_hba.conf`) and `infra/pgbackrest/pgbackrest.conf` (encrypted repository on the Mumbai bucket, `archive_timeout` 60 s, full weekly + differential daily, retention of two full sets and 14 days, `process-max` 2). The **daily `pgbackrest check`/`info`** runs as a scheduled worker job that **reuses the `job_runs` recorded-outcome model and the worker-only scheduling fixed in D-047**, alerting on failure or age. A change to the backup design is itself a D-record (infra.md).

### 6.4 Secrets with sops + age
`infra/secrets/*.enc.yaml` for the database and Redis passwords, Cognito, S3, Razorpay and provider keys, decrypted on the host at deploy; the age key only on the host and in the password manager. A **secret registry** (every secret, where it is used, rotation date) in the runbooks. A repo scan in CI proves no plaintext secret is ever committed (the existing transcript-redactor discipline extends here).

### 6.5 Host bootstrap + the security baseline
`infra/bootstrap.sh`: users, SSH key-only + no root, `ufw` default-deny allowing 22/80/443, Docker pinned by version, `unattended-upgrades`, `fail2ban`, time sync, swap, log rotation; SSH and sudo logs shipped off the box. `shellcheck` green; **idempotent** (a second run is a no-op); run clean on a fresh local VM. Every security-affecting host change goes through this script (infra.md), never by hand.

### 6.6 The deploy pipeline
`.github/workflows/deploy.yml`: build the image to GHCR on `main` and on tags; **deploy to staging on merge to main**; **deploy to production on a release tag**; a **migration job (expand steps only) before the new API starts**; a **health gate**; **rollback by redeploying the previous tag**; and a **refusal to deploy to production while the deploy-freeze flag is set** (decision 5). Releases stay reversible (expand-and-contract; contract steps ship a release later). Exercised end to end against a local/dry-run target this block; wired to the real host when access opens.

### 6.7 Monitoring and alerts
`infra/monitoring/`: node-exporter / Netdata config and the alert thresholds (disk 80 %, memory 90 %, backup age > 26 h, archive lag > 10 min, certificate < 14 days); Sentry for api/worker/app errors; an outside uptime monitor on the website, the API health endpoint and staging; failed-job and webhook-failure signals from the app's own metrics; **wedding-day mode** tightens thresholds while a project is live. An alert that fires without a runbook step gets one (infra.md).

### 6.8 Runbooks + the rehearsed rebuild
`infra/runbooks/`: rebuild-from-nothing, restore-the-database-only, deploy-and-roll-back, rotate-secrets, incident, upgrade-PostgreSQL (vps-setup §6). Then **rehearse the rebuild once, end to end, on a local VM**: provision → `bootstrap.sh` → place the age key → `sops` decrypt → bring up postgres + pgbackrest → `pgbackrest restore` to a point in time → start the rest → smoke green. Record the measured recovery point and time in the vault (AC-22; re-run on the real box once it exists, and monthly/quarterly thereafter).

## 6. Cross-cutting

- **Secrets:** `sops` + `age` only; never a secret in a Compose file, a workflow, an env file, a log or a fixture (infra.md, security.md). The age key never enters the repository.
- **Reproducibility:** nothing hand-built on a host; if something is done by hand during a rehearsal it is written back into `infra/` the same day.
- **Reuse:** the daily backup-check job uses the existing job seam (`defineJob`, `JobQueue`, worker-only scheduling) and the `job_runs` model (D-031, D-047) — no second scheduler. The deploy migration job runs the same Prisma migrations the e2e suite applies.
- **Migrations are expand-and-contract**; a release is reversible by redeploying the previous image.
- **Validation, not Vitest:** infra "done" means the validators, the local `compose up` smoke and the rebuild rehearsal pass; `pnpm check` stays green for any TypeScript touched (the backup-check job, the flag read).
- **New patterns get a D-record first** (Docker image, `sops`, the deploy workflow, the backup design).

## 7. What this leaves ready

A reproducible, code-defined server: one image, a hardened Compose stack behind Caddy, encrypted secrets, minute-granularity encrypted backups with a daily check, monitoring with runbook-backed alerts, staging auto-deploy on merge and tagged production deploys with a migration gate and one-tag rollback, and a rebuild rehearsed end to end. CRM & subscription (sprints 8–10) and every later module deploy onto this without touching the host by hand. Going live becomes an accounts-and-DNS step plus a release tag, not a server build.

**Still deferred (named, not forgotten):** the real box, the Mumbai buckets, the domain/email, the Sentry/uptime/CDN accounts and the age-key custody (AMPM / R15) — the live wiring, gated on the accounts, not on this block; a managed database beside the VPS (G1) or a warm standby with streaming replication if wedding-day availability demands it at launch (vps-setup §9); row-level security as a second line of defence (Phase 5); the real penetration test of the host (Phase 5).

## Appendix — external (AMPM / R15) dependencies

These gate the **live** path, not the sprint (local Compose + a local VM + a local S3 emulator stand in for everything below):

- **The VPS:** Hostinger KVM 4 purchased with the **Mumbai** datacentre selected; root/SSH access for the build sessions.
- **S3 Mumbai:** the backup repository bucket and the two file buckets (media, restricted identity), with the restricted bucket under its own key.
- **Domain + email authentication** (DKIM/SPF/DMARC), due around sprint 6.
- **Sentry**, an **uptime monitor**, and the **content network** in front of media — accounts and keys.
- **The age key** custody (host + the developer's password manager).
