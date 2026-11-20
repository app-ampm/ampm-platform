# AMPM production on the shared Plesk VPS: setup and operation

Production runs on the current VPS (31.97.62.74, Hostinger India, Mumbai), beside the test stack (D-138). This is the runbook: what runs where, how it was built, and how to deploy, back up, restore and go live. The open items before AMPM pitches clients are in [docs/planning/production-readiness.md](../../docs/planning/production-readiness.md).

## 1. What runs where

|                     | Production                                                                              | Test (demos, dev sign-in, synthetic data)                                     |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Portal              | https://app.ampmverse.com (`httpdocs/`)                                                 | https://test-app.ampmverse.com                                                |
| Website             | https://site.ampmverse.com                                                              | https://test-site.ampmverse.com                                               |
| Compose project     | `ampm`: `infra/compose/production/compose.yml` + `compose.box.yml`                      | `ampm-local`: `infra/compose/local/compose.yml` + `compose.test-override.yml` |
| Source on the box   | `/var/www/vhosts/app.ampmverse.com/ampm-prod`                                           | `/var/www/vhosts/app.ampmverse.com/ampm-test`                                 |
| API / website ports | 127.0.0.1:7101 / 7102                                                                   | 127.0.0.1:7001 / 7002                                                         |
| Sign-in             | AMPM's own (D-142): staff password + authenticator code; clients once mobile OTP exists | dev sign-in behind the password                                               |
| Deploy              | `deploy/redeploy-prod.sh`, `AMPM_WEB_TARGET=production deploy/deploy-web.sh`            | `deploy/redeploy-box.sh`, `AMPM_WEB_TARGET=test deploy/deploy-web.sh`         |

Both stacks sit behind Plesk: nginx terminates TLS, Apache applies each docroot's `.htaccess` (the reverse proxy, the security headers, the password curtain) and proxies to the loopback ports. Caddy does not run here. The production docroots use [`htaccess.production.example`](htaccess.production.example) and [`../site-ampmverse/htaccess.production.example`](../site-ampmverse/htaccess.production.example).

Box paths outside the source trees (none is served by a web root):

| Path                            | Holds                                                                 | Owner                             |
| ------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| `ampm-prod-secrets/` (700)      | `app.env`, `postgres.env`, `redis.env` (600): every production secret | app_ampmverse                     |
| `ampm-prod-storage/`            | uploaded media (D-106)                                                | uid 1000 (the containers' `node`) |
| `ampm-backups/pgbackrest-prod/` | the encrypted pgBackRest repository (D-139)                           | uid 999 (the image's `postgres`)  |
| `ampm-backups/pgdump/` (700)    | a logical dump before every deploy, 14 days kept                      | app_ampmverse                     |
| `ampm-prod-state/app-image`     | the app image that last passed the health gate (the rollback target)  | app_ampmverse                     |
| `bin/prod-secrets.sh`           | the secrets helper, also at `deploy/app-ampmverse/prod-secrets.sh`    | app_ampmverse                     |

## 2. Secrets (D-140)

Every production secret is in `ampm-prod-secrets/*.env`, written by [`prod-secrets.sh`](prod-secrets.sh) and never printed, committed or passed on a command line:

```bash
~/bin/prod-secrets.sh init                     # generate the database, Redis, backup-cipher, media and webhook secrets
ssh -t <box> '~/bin/prod-secrets.sh set app SMTP_PASSWORD'   # an operator-held value, typed with no echo
~/bin/prod-secrets.sh check                    # names only; exit 1 while one is missing
```

Never run `docker compose … config` unfiltered on the box: it prints the env files' values. The operator supplies `SMTP_PASSWORD` (a Resend API key with sending access; D-143), `EMAIL_FROM` (an address on a domain verified in Resend, for example `AMPM <noreply@ampmverse.com>`), `BOT_CHECK_SECRET` (Cloudflare Turnstile) and the Razorpay keys. **Keep an off-box copy of `postgres.env`'s `PGBACKREST_REPO1_CIPHER_PASS` in your password manager: without it no backup can be read.** Rotate a generated value by deleting its line and running `init` again, then redeploy (the database password also needs `ALTER ROLE ampm PASSWORD …`).

## 3. First build (done once, recorded here)

1. Ship merged `main` without the knowledge graph and record the commit:
   `git archive <commit> -- . ':(exclude)graphify-out' | ssh <box> 'mkdir -p ~/ampm-prod && cd ~/ampm-prod && tar -xf -'`, then write the commit to `~/ampm-prod/.deployed-commit`.
2. `cp ~/ampm-prod/deploy/app-ampmverse/compose.production-box.example.yml ~/ampm-prod/infra/compose/production/compose.box.yml`.
3. Directories: `ampm-prod-storage` owned by uid 1000 and `ampm-backups/pgbackrest-prod` owned by uid 999. The SSH user cannot `chown`, so a throwaway container does it as root, for example `docker run --rm --user 0 -v <dir>:/d --entrypoint chown ampm-prod-postgres:current 999:999 /d`.
4. `~/bin/prod-secrets.sh init`, then the operator values (section 2).
5. `bash ~/ampm-prod/deploy/redeploy-prod.sh`: builds, starts the data tier, takes a full backup on first start (the pgBackRest scheduler), migrates, starts the API, worker and website, and gates on `/health`.
6. Reference data and the first Super Admin, in a one-off container of the app image (so it works before the API can boot), with the link going straight into a private file:
   `docker compose -f … -f … --profile migrate run --rm -T migrate node --import tsx prisma/bootstrap.ts --super-admin-email <email> --super-admin-name "<name>" > ~/ampm-prod-secrets/first-admin-link.txt`
   They open the link (it works once, for 7 days), choose a password, scan the authenticator QR code, confirm its first code and save the ten recovery codes; the account is then active (D-142). Later staff are invited from the app, and a lost phone is an administrator's **Reset authenticator**.
7. Web: copy the two production `.htaccess` files into place, then `AMPM_WEB_TARGET=production WEB_SSH=<box> WEB_SSH_KEY=~/.ssh/ampm_test_vps bash deploy/deploy-web.sh` (add `AMPM_WEB_RETARGET=1` the first time, when `httpdocs` still carries the test marker).

## 4. Deploying a change

1. Merge to `main`, then ship that commit to `~/ampm-prod` exactly as in step 3.1. `tar` adds and replaces files, so a file deleted on `main` stays on the box until it is removed by hand.
2. `bash deploy/redeploy-prod.sh` on the box. Its order: preflight (override, secrets, disk), build, data tier, safety dump, **migrate before the new API**, recreate api/worker/web, health gate. A failed gate puts api and worker back on the previous image. It never seeds demo data.
3. If the change touched the portal: `AMPM_WEB_TARGET=production … deploy/deploy-web.sh` **after** the API (a contract change needs the new API first). Load a page and read the browser console.

The test stack deploys exactly as before, with `AMPM_WEB_TARGET=test` for its web bundle. Keep checking free disk (`df -h /`, `docker system df`) before a build; `redeploy-prod.sh` prunes dangling build cache itself below 15 GB free. Never prune volumes: other tenants' data lives in them.

## 5. Backups and restore (D-139)

- **What runs:** Postgres archives WAL every minute into the encrypted pgBackRest repository on this disk; the `pgbackrest` service takes a full backup on first start and then a full on Sundays and a differential on other days at 03:00 UTC, with a check after each (recorded on `job_runs`). Every deploy also writes a `pg_dump` into `ampm-backups/pgdump`. Media is copied nightly by [`backup-media.sh`](backup-media.sh) (cron).
- **What it does not cover:** losing this server. Nothing leaves the box until an off-box copy is chosen (D-139 lists the options). The provider's own VPS backups are the server owner's, not AMPM's.
- **Postgres runs under an init** (`init: true`, D-139): pgBackRest's async archiver leaves an orphaned process that the postmaster, as PID 1, would treat as a crashed backend. On 19–20 Nov 2026 that restarted the test stack's database every ~10 s.
- **Point-in-time restore:** stop api and worker, then `docker compose -f … -f … --profile restore run --rm restore` with `RESTORE_TARGET_TIME` set for a point in time (see [`infra/runbooks/restore.md`](../../infra/runbooks/restore.md)), start, verify, restart. **From a dump:** `pg_restore --clean --if-exists` into the stopped stack's database.
- **Rehearse monthly**: restore into a scratch container, run the smoke checks, record the recovery point and time in the vault.

## 6. Going live (when AMPM starts pitching clients)

Production sits behind the same password as test until then. Going live means working through the list in [production-readiness.md](../../docs/planning/production-readiness.md), then removing the `AuthType … </RequireAny>` block from both production `.htaccess` files. Before that, confirm two things: `POST https://app.ampmverse.com/_api/auth/dev-login` answers 404, and the API runs with `NODE_ENV=production`.
