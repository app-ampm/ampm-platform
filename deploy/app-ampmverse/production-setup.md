# AMPM production on the shared Plesk VPS: setup and operation

Production runs on the current VPS (31.97.62.74, Hostinger India, Mumbai), beside the test stack (D-138). This is the runbook: what runs where, how it was built, and how to deploy, back up, restore and go live. The open items before AMPM pitches clients are in [docs/planning/production-readiness.md](../../docs/planning/production-readiness.md).

## 1. What runs where

|                     | Production                                                                              | Test (retired at the cutover, D-144: stopped, volumes kept)                   |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Portal              | https://app.ampmverse.com (`httpdocs/`)                                                 | none (it served app.ampmverse.com until the cutover)                          |
| Website             | https://site.ampmverse.com                                                              | none (it served site.ampmverse.com until the cutover)                         |
| Compose project     | `ampm`: `infra/compose/production/compose.yml` + `compose.box.yml`                      | `ampm-local`: `infra/compose/local/compose.yml` + `compose.test-override.yml` |
| Source on the box   | `/var/www/vhosts/app.ampmverse.com/ampm-prod`                                           | `/var/www/vhosts/app.ampmverse.com/ampm-test`                                 |
| API / website ports | 127.0.0.1:7101 / 7102                                                                   | 127.0.0.1:7001 / 7002                                                         |
| Sign-in             | AMPM's own (D-142): staff password + authenticator code; clients once mobile OTP exists | dev sign-in behind the password                                               |
| Deploy              | `deploy/redeploy-prod.sh`, `AMPM_WEB_TARGET=production deploy/deploy-web.sh`            | `deploy/redeploy-box.sh`, `AMPM_WEB_TARGET=test deploy/deploy-web.sh`         |

Both stacks sit behind Plesk: nginx terminates TLS, Apache applies each docroot's `.htaccess` (the reverse proxy, the security headers, the password curtain) and proxies to the loopback ports. Caddy does not run here. The production docroots use [`htaccess.production.example`](htaccess.production.example) and [`../site-ampmverse/htaccess.production.example`](../site-ampmverse/htaccess.production.example).

Box paths outside the source trees (none is served by a web root):

| Path                             | Holds                                                                 | Owner                             |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| `ampm-prod-secrets/` (700)       | `app.env`, `postgres.env`, `redis.env` (600): every production secret | app_ampmverse                     |
| `ampm-prod-storage/`             | uploaded media (D-106)                                                | uid 1000 (the containers' `node`) |
| `ampm-backups/pgbackrest-prod/`  | the encrypted pgBackRest repository (D-139)                           | uid 999 (the image's `postgres`)  |
| `ampm-backups/pgdump/` (700)     | a logical dump before every deploy, 14 days kept                      | app_ampmverse                     |
| `ampm-backups/media-prod/` (700) | a nightly archive of the media store, 14 days kept                    | app_ampmverse                     |
| `ampm-prod-state/app-image`      | the app image that last passed the health gate (the rollback target)  | app_ampmverse                     |
| `bin/prod-secrets.sh`            | the secrets helper, also at `deploy/app-ampmverse/prod-secrets.sh`    | app_ampmverse                     |

### Antivirus

Every upload (gallery media and documents) is streamed to ClamAV and stored only if it comes back clean (AC-20.3). Two containers run from the official image pinned in the base compose (`clamav/clamav:1.5.5_base`):

- `clamav` is clamd alone, on the internal network, with no internet. The API connects to `clamav:3310`, set by `AV_PROVIDER: clamav` and `CLAMAV_HOST: clamav` in `compose.box.yml`. Production refuses the stub scanner, and `redeploy-prod.sh` stops early when those lines are missing.
- `freshclam` downloads the signatures over egress into the `ampm_clamav-db` volume and checks 12 times a day. clamd picks new signatures up within 10 minutes (its self-check) and reloads them in place.

How it behaves:

- **Fail closed.** A threat is refused: media is quarantined, and a document gets a 400 ("failed the antivirus scan"). If clamd is down, slow (`CLAMAV_TIMEOUT_MS`, 30 s) or answers anything else, the upload gets a 503 ("The virus scanner is unavailable…") and nothing is stored or changed, so the uploader can retry. The API starts and serves everything else without the scanner.
- **First start.** freshclam downloads 113 MB (`main`, `daily`, `bytecode`) and test-loads each set; clamd waits for them, then loads them in about 10 s. On a laptop on 20 Nov 2026 both were healthy 34 s after `up`. `redeploy-prod.sh` starts the pair without waiting and reports the scanner's health at its end.
- **Memory** (measured with ClamAV 1.5.5 and 3.6 million signatures): clamd uses about 1.0 GB, also through a reload, because `ConcurrentDatabaseReload no` keeps one copy of the signatures (scans pause for a few seconds instead). freshclam idles at about 50 MB and peaks at 0.7 GB while it test-loads a new set. Each is limited to 1.5 GB.
- **Restarts.** clamd is its container's main process, so a crash or an out-of-memory kill ends the container and Docker restarts it.
- **Health and logs.** `clamav` is healthy while clamd answers `PING`. `freshclam` turns unhealthy once the daily signatures are three days old, which means updates are failing (its logs show why, for example a CDN cool-down after HTTP 429). `docker compose -f … -f … logs clamav freshclam` shows both. freshclam's "Clamd was NOT notified" after an update is expected, since clamd runs in another container. The API logs `storage.av_scan.threat_found` with the signature name, and `storage.av_scan.unavailable` or `storage.av_scan.no_verdict` when it got no verdict.

Smoke test after a deploy, run on the box from `~/ampm-prod` (nothing is stored):

```bash
docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml exec -T clamav sh -c 'echo VERSION | nc -w 5 127.0.0.1 3310'
```

It prints the engine, the daily signature version and its date, for example `ClamAV 1.5.5/28189/Fri Nov 20 06:29:13 2026`. Then check that the daemon finds the EICAR test file, here as a PDF stream object:

```bash
python3 - <<'PY' | docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml exec -T clamav clamdscan --no-summary -
e = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$" + "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
print(f"%PDF-1.4\n1 0 obj\n<< /Length {len(e)} >>\nstream\n{e}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF")
PY
```

It must print `stream: Eicar-Signature FOUND`. The same PDF uploaded as a document in the app must be refused with "The file failed the antivirus scan and was not stored", and any photo uploaded to a hotel gallery must be stored, which proves the API reaches clamd. ClamAV flags the EICAR file only at the start of a file or as a PDF stream object. The development stub flags it anywhere, so a JPEG with EICAR hidden after its header is quarantined in tests but clean in production.

## 2. Secrets (D-140)

Every production secret is in `ampm-prod-secrets/*.env`, written by [`prod-secrets.sh`](prod-secrets.sh) and never printed, committed or passed on a command line:

```bash
~/bin/prod-secrets.sh init                     # generate the database, Redis, backup-cipher, media and webhook secrets
ssh -t -o ServerAliveInterval=15 <box> '~/bin/prod-secrets.sh set app SMTP_PASSWORD'   # an operator-held value, pasted with no echo
~/bin/prod-secrets.sh check                    # names only; exit 1 while one is missing
```

Never run `docker compose … config` unfiltered on the box: it prints the env files' values. The operator supplies `SMTP_PASSWORD` (a Resend API key with sending access; D-143), `EMAIL_FROM` (an address on a domain verified in Resend, for example `AMPM <noreply@ampmverse.com>`), `BOT_CHECK_SECRET` (Cloudflare Turnstile) and the Razorpay keys. **Keep an off-box copy of `postgres.env`'s `PGBACKREST_REPO1_CIPHER_PASS` in your password manager: without it no backup can be read.** Rotate a generated value by deleting its line and running `init` again, then redeploy (the database password also needs `ALTER ROLE ampm PASSWORD …`).

Where the operator values come from (set up on 20 November 2026, both accounts on AMPM's operations Google login):

- **Resend** (`SMTP_PASSWORD`, D-143): the domain `ampmverse.com`, region Tokyo (`ap-northeast-1`), verified on 20 Nov 2026. Resend's **Auto configure** added its three records at GoDaddy through Domain Connect (template `resend.com/mail-mta`, groups `dkim`, `outbound`, `mta`): TXT `resend._domainkey` (the DKIM key), CNAME `send` → `send.forge.rmta.net` and CNAME `rsend` → `rsend-apne1.forge.rmta.net`. The root MX and SPF records (Google) are untouched and receiving is off; DMARC (`p=quarantine`, relaxed alignment) passes on the DKIM signature for `ampmverse.com`. `SMTP_PASSWORD` is the API key "AMPM production server (SMTP)": sending access, `ampmverse.com` only. Resend shows a key once; a lost key is replaced, not recovered.
- **Turnstile** (`BOT_CHECK_SECRET`): the widget "AMPM website", Managed, for `ampmverse.com`, `site.ampmverse.com` and `www.ampmverse.com`. Its site key `0x4AAAAAAGKBfk9-4261LTAN` is public and goes into the website build; the secret is `BOT_CHECK_SECRET`. A secret can be rotated once every two hours (Edit widget → Rotate Secret Key), and the previous one keeps working for two hours.
- **Pasting a value:** open the `set` prompt only once the value is on the clipboard, with `ssh -t -o ServerAliveInterval=15 …` so an idle prompt is not dropped, and copy commands from this runbook, never from a terminal's wrapped scrollback. On 20 Nov 2026 a prompt left waiting was reset, the pasted Turnstile secret landed in the Mac shell instead, and the secret was rotated.

### Wiring SMS (client sign-in codes, D-147)

Clients sign in, and invited clients activate, with a six-digit code sent to the mobile AMPM has on file. Until an SMS provider is wired, the box runs `SMS_PROVIDER: console` with `CLIENT_OTP_SCREEN_ECHO: "true"`. Each code then goes to the console stub, which logs only the channel and template, and back to the screen. While that holds, **anyone who knows a client's mobile can sign in as that client**. The password curtain that kept the client-code routes private was removed on 20 Nov 2026 at the user's decision (D-148), so **until the on-screen code is off, convert and invite no real client**: only test clients on AMPM's own numbers. The API logs `auth.client_code_screen_echo_on` at every boot. To put the curtain back, uncomment the blocks in both `.htaccess` files. To wire SMS:

1. **Register on a DLT portal**: AMPM as the principal entity (PE ID), a six-letter sender ID (header), and this content template. It is the text the API sends, with the code as the variable:
   `{#var#} is your AMPM sign-in code. It expires in 5 minutes. Do not share it with anyone. - AMPM`
   The text must stay equal to `auth.client_otp` in `packages/core/src/schemas/config.ts`. It takes 2–4 weeks, about ₹5,000–10,000 a year.
2. **Open the provider account and register the template there.**
   - **2Factor:** add the header and the template with their DLT IDs. `SMS_OTP_TEMPLATE` is the DLT content-template ID, `SMS_DLT_ENTITY_ID` the PE ID, and `SMS_SENDER_ID` the header.
   - **MSG91:** create the SMS template with `##code##` in place of `{#var#}`, mapped to the DLT template ID and the header, and approve it. `SMS_OTP_TEMPLATE` is MSG91's template ID. Whitelist the box's outgoing IP (31.97.62.74) on the auth key.
3. **On the box:**
   - `ssh -t -o ServerAliveInterval=15 <box> '~/bin/prod-secrets.sh set app SMS_API_KEY'`.
   - In `compose.box.yml` set `SMS_PROVIDER` and the IDs above, keeping `CLIENT_OTP_SCREEN_ECHO: "true"`.
   - Run `deploy/redeploy-prod.sh`.
4. **Test with a real number.** Sign in as a client account that has your own mobile, and check that the SMS arrives with the same code the screen shows. The provider's answer is logged as `notification.sms_sent` with its reference. A failure is logged as a bare code such as `2factor_400` or `msg91_200`, and the job retries it.
5. **Switch the on-screen code off.** Set `CLIENT_OTP_SCREEN_ECHO: "false"`, redeploy, and tick the item in the readiness tracker. Production refuses `console` without the on-screen code, so the order matters. Real clients may be converted and invited only after this step (D-148).

The limits: five codes an hour and ten a day per number, with a 30-second pause between codes. A code lasts 5 minutes and burns after 5 wrong tries. A number with no client gets the same answer and no SMS, so the endpoint cannot text arbitrary numbers. Neither provider deduplicates, so a job retry after a timeout can send the same code twice.

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
7. Web: copy the two production `.htaccess` files into place, then `AMPM_WEB_TARGET=production WEB_SSH=<box> WEB_SSH_KEY=~/.ssh/ampm_test_vps bash deploy/deploy-web.sh` (add `AMPM_WEB_RETARGET=1` the first time, when `httpdocs` still carries the test marker). Keep staged or backup `.htaccess` copies outside `httpdocs`: the web deploy's `rsync --delete` spares only the exact names `.htaccess`, `.htpasswd`, `.well-known/` and `.ampm-target`.

Done on 20 Nov 2026 (UTC): production built at 09:02. The API and worker started on `26387e5` at 09:41, after the operator values were in. The portal bundle and both production `.htaccess` files went in at 09:44, and the test stack stopped right after (D-144). The test stack's previous `.htaccess` files are kept in `ampm-prod-state/edge-20261120/`.

## 4. Deploying a change

1. Merge to `main`, then ship that commit to `~/ampm-prod` exactly as in step 3.1. `tar` adds and replaces files, so a file deleted on `main` stays on the box until it is removed by hand.
2. `bash deploy/redeploy-prod.sh` on the box. Its order: preflight (override, secrets, disk), build, data tier and virus scanner, safety dump, **migrate before the new API**, recreate api/worker/web, health gate, then the scanner's health (reported, not gated). A failed gate puts api and worker back on the previous image. It never seeds demo data.
3. If the change touched the portal: `AMPM_WEB_TARGET=production … deploy/deploy-web.sh` **after** the API (a contract change needs the new API first). Load a page and read the browser console.

The test stack deploys exactly as before, with `AMPM_WEB_TARGET=test` for its web bundle. Keep checking free disk (`df -h /`, `docker system df`) before a build; `redeploy-prod.sh` prunes dangling build cache itself below 15 GB free. Never prune volumes: other tenants' data lives in them.

## 5. Backups and restore (D-139)

- **What runs:** Postgres archives WAL every minute into the encrypted pgBackRest repository on this disk; the `pgbackrest` service takes a full backup on first start and then a full on Sundays and a differential on other days at 03:00 UTC, with a check after each (recorded on `job_runs`). Every deploy also writes a `pg_dump` into `ampm-backups/pgdump`. Media is archived nightly at 02:15 UTC by [`backup-media.sh`](backup-media.sh) into `ampm-backups/media-prod` (the SSH user's crontab, installed 20 Nov 2026; the entry is in the script's header; its log is `ampm-backups/media-backup.log`).
- **What it does not cover:** losing this server. Nothing leaves the box until an off-box copy is chosen (D-139 lists the options). The provider's own VPS backups are the server owner's, not AMPM's.
- **Postgres runs under an init** (`init: true`, D-139): pgBackRest's async archiver leaves an orphaned process that the postmaster, as PID 1, would treat as a crashed backend. On 19–20 Nov 2026 that restarted the test stack's database every ~10 s.
- **Point-in-time restore:** stop api and worker, then `docker compose -f … -f … --profile restore run --rm restore` with `RESTORE_TARGET_TIME` set for a point in time (see [`infra/runbooks/restore.md`](../../infra/runbooks/restore.md)), start, verify, restart. **From a dump:** `pg_restore --clean --if-exists` into the stopped stack's database.
- **Rehearse monthly**: restore into a scratch container, run the smoke checks, record the recovery point and time in the vault.

## 6. Going live (when AMPM starts pitching clients)

The password curtain came off on 20 Nov 2026 (D-148); both sites are public and send `X-Robots-Tag: noindex, nofollow`. Going live means working through the list in [production-readiness.md](../../docs/planning/production-readiness.md), **switching the on-screen client code off ("Wiring SMS") first**, then removing the `X-Robots-Tag` lines (the curtain blocks are already commented out) from both production `.htaccess` files. Before that, confirm two things: `POST https://app.ampmverse.com/_api/auth/dev-login` with a well-formed body (`{"email":"nobody@example.com"}`) answers 404 (an empty body gets validation's 400 first: the route exists everywhere and refuses outside a local, non-production build), and the API runs with `NODE_ENV=production`. Both held on 20 Nov 2026.
