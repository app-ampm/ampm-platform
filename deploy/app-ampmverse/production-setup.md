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

| Path                             | Holds                                                                     | Owner                             |
| -------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| `ampm-prod-secrets/` (700)       | `app.env`, `postgres.env`, `redis.env` (600): every production secret     | app_ampmverse                     |
| `ampm-prod-storage/`             | uploaded media (D-106)                                                    | uid 1000 (the containers' `node`) |
| `ampm-backups/pgbackrest-prod/`  | the encrypted pgBackRest repository (D-139)                               | uid 999 (the image's `postgres`)  |
| `ampm-backups/pgdump/` (700)     | a logical dump before every deploy, 14 days kept                          | app_ampmverse                     |
| `ampm-media-snapshots/` (750)    | 14 nightly hard-link snapshots of the media store (D-177)                 | uid 1000                          |
| `ampm-backups/media-prod/` (700) | the nightly archives written until 24 Nov 2026, each pruned after 14 days | app_ampmverse                     |
| `ampm-prod-state/app-image`      | the app image that last passed the health gate (the rollback target)      | app_ampmverse                     |
| `bin/prod-secrets.sh`            | the secrets helper, also at `deploy/app-ampmverse/prod-secrets.sh`        | app_ampmverse                     |

### Antivirus

Every upload (gallery media and documents) is streamed to ClamAV and stored only if it comes back clean (AC-20.3). Two containers run from the official image pinned in the base compose (`clamav/clamav:1.5.5_base`):

- `clamav` is clamd alone, on the internal network, with no internet. The API connects to `clamav:3310`, set by `AV_PROVIDER: clamav` and `CLAMAV_HOST: clamav` in `compose.box.yml`. Production refuses the stub scanner, and `redeploy-prod.sh` stops early when those lines are missing.
- `PUBLIC_SITE_URL` in `compose.box.yml` is the website's origin, `https://site.ampmverse.com`: the hotel information form's links point to it (D-188). Production refuses http or a local host, and `redeploy-prod.sh` stops early when the line is missing, so add it to the box's `compose.box.yml` before the first deploy of Slice 7a.
- `freshclam` downloads the signatures over egress into the `ampm_clamav-db` volume and checks 12 times a day. clamd picks new signatures up within 10 minutes (its self-check) and reloads them in place.

How it behaves:

- **Fail closed.** A threat is refused: media is quarantined, and a document gets a 400 ("failed the antivirus scan"). If clamd is down, slow (`CLAMAV_TIMEOUT_MS`, 30 s) or answers anything else, the upload gets a 503 ("The virus scanner is unavailable…") and nothing is stored or changed, so the uploader can retry. The API starts and serves everything else without the scanner.
- **Limits and alerts** (D-177, set in the base compose's `CLAMD_CONF_*` lines). `StreamMaxLength` and `MaxFileSize` are 32M, `MaxScanSize` 100M, `MaxRecursion` 16 and `MaxFiles` 5000. The image's defaults were 100M, 100M, 400M, 17 and 10000, with every Alert option off (measured 24 Nov 2026). 32M fits every upload: media is capped at 25 MiB, documents at 20 MiB and import CSVs at 5 MiB.
  - A longer stream gets clamd's size-limit error, which the API treats as no verdict: a 503, and nothing is stored.
  - `AlertExceedsMax` refuses a file past the scan limits, a ZIP that unpacks past 100M for example, instead of passing it unscanned.
  - `AlertOLE2Macros` and `AlertEncryptedArchive` refuse Office files with macros and encrypted archives.
  - `AlertEncryptedDoc` flags only a PDF that needs a password to open (`Heuristics.Encrypted.PDF`). A permission-locked PDF, with an owner password only, as signed contracts often have, passes. Tested on the box on 24 Nov 2026 with the production image, `clamscan` and synthetic PDFs. A password-to-open PDF is refused as a scan rejection ("failed the antivirus scan"); its own wording comes with the hotel form's upload reasons in Slice 9.
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

After a deploy that changes the `CLAMD_CONF_*` lines (Compose recreates `clamav` for it), check the settings clamd runs with:

```bash
docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml exec -T clamav clamconf | grep -E '^(StreamMaxLength|MaxFileSize|MaxScanSize|MaxRecursion|MaxFiles|AlertExceedsMax|AlertOLE2Macros|AlertEncryptedArchive|AlertEncryptedDoc|ConcurrentDatabaseReload) '
```

Each limit must show the value above (a size may print in bytes: 32M is 33554432, 100M is 104857600), each Alert option `yes`, and `ConcurrentDatabaseReload` disabled.

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

1. Ship merged `main` from a checkout:
   `AMPM_SHIP_TARGET=production SHIP_SSH=<box> SHIP_SSH_KEY=~/.ssh/ampm_test_vps bash deploy/ship-source.sh`. It unpacks `origin/main` into `~/ampm-prod` without the knowledge graph, and records the commit in `.deployed-commit` and every file's checksum in `.deployed-manifest` (D-156).
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

1. Merge to `main`, then ship it with `deploy/ship-source.sh` as in step 3.1 (another commit goes as its last argument). The script first checks that the box's tree is still the commit it last received. If a file was edited by hand or a ship did not finish, it lists the files and stops; `SHIP_FORCE=1` replaces them. It then removes what `main` deleted or renamed since that commit, unpacks the new one and checks the result. A plain `git archive | tar` only adds and replaces files, so a deleted file stayed on the box and the build still compiled it (D-156).
2. `bash deploy/redeploy-prod.sh` on the box. Its order: preflight (the tree as shipped, checked by `deploy/verify-shipped-source.sh`, so a tree shipped by hand is refused; override; secrets; disk), build, data tier and virus scanner, safety dump, **migrate before the new API**, recreate api/worker/web, health gate, then the scanner's health (reported, not gated). A failed gate puts api and worker back on the previous image. It never seeds demo data.
3. If the change touched the portal: `AMPM_WEB_TARGET=production … deploy/deploy-web.sh` **after** the API (a contract change needs the new API first). Load a page and read the browser console.

The test stack deploys the same way, with `AMPM_SHIP_TARGET=test` for its source and `AMPM_WEB_TARGET=test` for its web bundle. Keep checking free disk (`df -h /`, `docker system df`) before a build. `redeploy-prod.sh` prunes dangling build cache itself below 15 GB free, and after every deploy that passes its gate it trims the build cache to 8 GiB, least recently used first (section 6). Never prune volumes: other tenants' data lives in them.

### Rolling back a release by hand

`redeploy-prod.sh` puts api and worker back on the previous image by itself when the health gate fails. To go back later, do what its rollback does, in this order. The commands on the box run from `~/ampm-prod`.

1. **Find the image to go back to, before stopping anything.**
   - `cat ~/ampm-prod-state/app-image` names the image that is running.
   - `docker image ls ampm-prod-app --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}'` must list the one before it, under its full name, `ampm-prod-app:<the commit's first 12 characters>`. Use that name, never the image ID or a 7-character commit.
   - A deploy keeps the image it replaced. A rerun of the same commit, and a first deploy, delete none.
   - If the image is not listed (it is older, or was removed by hand), build it first, while the release still runs. Ship its commit from a checkout: `AMPM_SHIP_TARGET=production SHIP_SSH=app_ampmverse@31.97.62.74 SHIP_SSH_KEY=~/.ssh/ampm_test_vps bash deploy/ship-source.sh <commit>`. Then build it on the box: `AMPM_IMAGE=ampm-prod-app:<12 characters> docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml build api`. If you then decide not to roll back, ship the release again.
2. **Read the release's note in [`docs/data-model.md`](../../docs/data-model.md).** A migration that only adds still limits a rollback once the release has written values the previous image cannot read. For example, the hotel information form's Slice 3 venue types need a remap: see "Rolling back past this migration", and "Rolling forward again" for the way back.
   - When the note says to, stop api and worker first: `docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml stop api worker`.
   - Then run its SQL in the postgres container. Send it on stdin, so that its quotes survive the shell:

     ```bash
     docker exec -i ampm-postgres-1 sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
     -- paste the note's block here, BEGIN to COMMIT
     SQL
     ```

3. **Start the previous image:** `AMPM_IMAGE=ampm-prod-app:<tag> docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml up -d --no-deps --no-build --wait api worker`. Then check `curl -s http://127.0.0.1:7101/health`.
   - Keep `--no-build`. The api service has a build section, so without it Compose would build a tag the box does not hold from this tree, which is still the release, under the old name.
4. **Record it.** Write `ampm-prod-app:<tag>` into `~/ampm-prod-state/app-image` and into the `AMPM_IMAGE` line of `infra/compose/production/.env`. Otherwise the next deploy's own rollback, or a manual compose command, brings the release back.
5. **Take the portal bundle back** when the release changed a contract (hotel information form plan §10.2 item 7). `deploy-web.sh` keeps no copy of `httpdocs`, so restore the copy taken before the deploy.
6. **Ship the commit you went back to**, with step 1's `ship-source.sh` command, unless step 1 already did. Until then the box's tree and `.deployed-commit` still hold the release. Any `redeploy-prod.sh`, even one run for an environment change, would rebuild and start the release beside the old portal, without the roll-forward SQL.
   - Afterwards `prisma migrate status` lists the release's migration as applied but not found locally. That is expected.

Coming back to the release is an ordinary ship and deploy of it: `ship-source.sh`, then `redeploy-prod.sh`, then `deploy-web.sh` after a copy of `httpdocs`. Then run the note's roll-forward SQL, if it has any, as in step 2.

## 5. Backups and restore (D-139)

- **What runs:** Postgres archives WAL every minute into the encrypted pgBackRest repository on this disk; the `pgbackrest` service takes a full backup on first start and then a full on Sundays and a differential on other days at 03:00 UTC, with a check after each (recorded on `job_runs`). Every deploy also writes a `pg_dump` into `ampm-backups/pgdump`. Media is snapshotted nightly at 02:15 UTC by [`backup-media.sh`](backup-media.sh) into `ampm-media-snapshots` ("Media snapshots", below).
- **What it does not cover:** losing this server. None of AMPM's own copies leaves the box until an off-box copy is chosen (D-139 lists the options). The one copy off the box is the VPS provider's daily disk backup, the second layer for media (D-177; "Media snapshots", below).
- **Postgres runs under an init** (`init: true`, D-139): pgBackRest's async archiver leaves an orphaned process that the postmaster, as PID 1, would treat as a crashed backend. On 19–20 Nov 2026 that restarted the test stack's database every ~10 s.
- **Point-in-time restore:** stop api and worker, then `docker compose -f … -f … --profile restore run --rm restore` with `RESTORE_TARGET_TIME` set for a point in time (see [`infra/runbooks/restore.md`](../../infra/runbooks/restore.md)), start, verify, restart. **From a dump:** `pg_restore --clean --if-exists` into the stopped stack's database.
- **Rehearse monthly**: restore into a scratch container, run the smoke checks, record the recovery point and time in the vault.

### Media snapshots (D-177)

Every night at 02:15 UTC the SSH user's cron runs [`backup-media.sh`](backup-media.sh); the entry is in the script's header and has not changed since 20 Nov 2026. Each run makes `ampm-media-snapshots/<UTC stamp>/`, a copy of `ampm-prod-storage` made of hard links (`cp -al`), and keeps the newest 14. The API never rewrites a stored file: every write replaces the file with a new one (it writes `<key>.<random>.tmp` beside the key and renames it over the key; `LocalStorageAdapter.putObject`), so a snapshot keeps the version it linked. A snapshot costs almost no space until a file is replaced or deleted: then the snapshots that hold the old version keep it, for up to 14 days. A `.tmp` file left in the store is a write the API never finished; the key beside it still holds its last complete version. Each run logs one line to `ampm-backups/media-backup.log`, for example `media snapshot 20261125T021500Z: 0 files, 1 snapshots kept`. The tar.gz archives that the script wrote until 24 Nov 2026 stay in `ampm-backups/media-prod`, each pruned after 14 days; no new one is written.

- **Why a container.** The live files belong to uid 1000, and `fs.protected_hardlinks = 1` lets only their owner, or root, link them; the SSH user (uid 10044) cannot (measured 24 Nov 2026). So the linking runs as uid 1000 in a throwaway container of the running app image (`ampm-prod-state/app-image`). The container has no network, a read-only root, the vhost root's group, and one bind mount of the whole vhost root, because a hard link cannot cross two mounts, even two mounts of one filesystem.
- **Partial runs.** A run that dies leaves `<stamp>.partial`, which the next run removes: only a complete snapshot gets its final name. Pruning touches only names of the snapshot form (`20261125T021500Z`), so nothing else in the snapshot root is ever removed.
- **One run at a time.** Each run holds a lock on `ampm-prod-state/backup-media.lock` (`flock`); a second run while one is going stops with a message and exits 1.
- **Refusals,** each before any container runs, with a message and exit 1: a media directory or snapshot root outside the vhost root or in its web root (`httpdocs`); a snapshot root that is a link, or that holds the store or sits inside it; an existing snapshot root that is not a directory of uid 1000, so a mistyped `SNAPSHOT_DIR` never hands a folder over (remove an empty one made by hand); `OWNER` uid 0; and no image to run.
- **A clock set back.** A run whose new snapshot is pruned at once, because 14 snapshots have later names, fails with a message, so the log shows that the snapshots stopped moving.
- **The first run** makes `ampm-media-snapshots` (owner uid 1000, mode 0750) at the vhost root through a root container that mounts the vhost root, and logs a line saying so; it makes it only when it does not exist. It sits beside the store, not in `ampm-backups`: uid 1000 reaches the vhost root (mode 710) through its group, but cannot enter `ampm-backups` (mode 700, the SSH user's alone; measured 24 Nov 2026). Do not make the folder by hand: one of the SSH user's is refused. To see the first run at once rather than at 02:15, run the cron's line by hand as the SSH user, without the `>>` log part; it prints the "made the snapshot root" line, then the snapshot's line.

The snapshots belong to uid 1000, so read and restore them through the same container. The commands below run on the box; `NODE` is set once per shell:

```bash
V=/var/www/vhosts/app.ampmverse.com
NODE=(docker run --rm --pull never --network none --read-only --security-opt no-new-privileges --user 1000:1000 --group-add "$(stat -c %g $V)" -v "$V:/v" --entrypoint /bin/sh "$(cat $V/ampm-prod-state/app-image)")
"${NODE[@]}" -c 'ls -l /v/ampm-media-snapshots'
```

**Restore one file.** Use its storage key (the media row's `storage_key`, or the document's) and a snapshot's stamp. A photo is three files: the original at `<key>`, and its derivatives `<key>.web` and `<key>.thumb` (`apps/api/src/modules/media/media-content.ts`); a video, a GIF or a document is one. The command links back each of the three that the snapshot holds and prints its name. `ln -f` replaces the live file with the snapshot's, never rewriting a file in place, so the other snapshots keep their versions:

```bash
"${NODE[@]}" -c 'set -e; cd "/v/ampm-media-snapshots/$1"; for f in "$2" "$2.web" "$2.thumb"; do [ -e "$f" ] || continue; mkdir -p "$(dirname "/v/ampm-prod-storage/$f")"; ln -f "$f" "/v/ampm-prod-storage/$f"; echo "restored $f"; done' sh <stamp> <key>
```

**Restore the whole store** from a snapshot. `cp -aln` links back every file the snapshot holds that the store no longer has, leaves every file the store still has, and exits 0: files deleted since the snapshot come back, files added since it stay, and a file replaced since it keeps its new version (restore that one with the command above). Plain `cp -a` does not do: for every file the two still share, GNU cp 9.1 (Debian bookworm's, the app image's) prints "are the same file" and exits 1. Newer GNU cp releases changed what `-n` does, so check this again when the image's Debian changes.

```bash
cd ~/ampm-prod
docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml stop api worker
"${NODE[@]}" -c 'cp -aln "/v/ampm-media-snapshots/$1/." /v/ampm-prod-storage/' sh <stamp>
"${NODE[@]}" -c 'find /v/ampm-prod-storage ! -user 1000 | head -n 5; find /v/ampm-prod-storage -type f | wc -l'
docker compose -f infra/compose/production/compose.yml -f infra/compose/production/compose.box.yml start api worker
```

The check after the copy (the fourth line) must print no path, then the number of files. Then open a hotel's gallery in the app and load a photo.

**The second layer, off the box.** The VPS provider's daily disk backup copies the whole disk off the server, so it covers the loss of the server, which the snapshots cannot. It cannot be seen or checked from the box. The developer confirms in the provider's panel that it is on, that it runs daily and when it last ran, and records that in HF-G5's notes. Restoring it brings back the whole disk as it was at that backup.

## 6. Disk space (D-177)

Every store sits on the one filesystem, `/dev/sda1` (193 GB): the media store and its snapshots, the WAL archive, the pgBackRest repository, the dumps, nginx's client-body temporary directory and Docker's data. On 24 Nov 2026 it had 35 GB free, down from 49 GB the day before. Each deploy's image build grows Docker's build cache, which stood at 23.5 GB, 15.4 GB of it reclaimable; images took 13.5 GB.

The install layer comes after `COPY . .` in `infra/docker/Dockerfile`, so every deploy adds a fresh one of about 5 GB, and no later build uses the old ones. Docker's own garbage collection (`docker buildx inspect default`) keeps up to 18.63 GiB of that cache, a tenth of the disk, whenever less than 36.32 GiB is free. After the Slice 5 deploy the cache stood at 28.4 GB, 20.4 GB of it reclaimable, with 29.6 GiB free.

Since D-186, every deploy that passes its gate trims the cache to 8 GiB, least recently used first (`docker builder prune -f --max-used-space 8GB`, logged), which keeps the last build's layers for a rerun. The trim replaces D-185's 7-day window, which freed nothing with a deploy a day. Below 15 GB free, the preflight still prunes dangling cache before it builds. Any prune is daemon-wide, so it trims other tenants' build cache too, never their images or volumes.

**The disk check.** Every 15 minutes the worker runs `system.disk_check`: `statfs` of `/data/storage`, the media store's mount, so one figure covers every store above. It compares the free space with configuration `storage.disk_guard`:

| Level      | Free space                       | Default |
| ---------- | -------------------------------- | ------- |
| `ok`       | at or above `warnGiB`            | 12 GiB  |
| `low`      | below `warnGiB`                  |         |
| `critical` | below `floorGiB`, at least 9 GiB | 9 GiB   |

Below the floor, the hotel form's upload guard will refuse new files (Slice 9).

- **Who is told.** Every active staff user with the Super Admin or the Hotel team role, in-app and by email. Example: "The AMPM server has 8.4 GB of disk free, below the 9 GB floor: new hotel-form uploads are refused until space is freed." The figures are GiB; the notices name no path.
- **When.** On a move to a worse level, then at most once every 24 hours per level while the space stays there; then one in-app notice when it is back above the warning level. The history is the job's own `job_runs` rows, so a restarted worker neither repeats an alert nor forgets one. The notices follow each person's notification preferences, under the event `system.disk_space`.
- **A failed measurement** is recorded as a failed run, alerts no one, and the queue retries it.
- **Changing the levels.** In the admin console, Configuration → "Disk space alerts" (Super Admin; whole GiB, the floor at least 9 and the warning level above it). The worker reads the new values within 5 minutes.
- **The latest runs:**

  ```bash
  docker exec -i ampm-postgres-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
  SELECT started_at, status, detail_json, error FROM job_runs WHERE job_name = 'system.disk_check' ORDER BY started_at DESC LIMIT 5;
  SQL
  ```

**Freeing space**, in this order:

1. The build cache, which the last deploy left at 8 GiB or less: `docker builder prune -f` removes all of it that no running build uses. The next build installs everything again and takes longer.
2. App images older than the rollback target, if any is left: `docker image ls ampm-prod-app`.
3. Old safety dumps in `ampm-backups/pgdump`, which already go after 14 days.

Never prune volumes, and never delete from the WAL archive or the pgBackRest repository by hand. When that is not enough, add disk or move media to online storage (the plan's §4.5).

## 7. Edge limits and the client's address (D-177)

On 24 Nov 2026 the edge had no effective size limit. nginx passed at least 40 MiB to an upload route, where Plesk's own limit is 128m. The API's pre-guard parser of the time cut the body off at 26 MB and Apache answered a 502 page. A 2 MiB JSON body reached the API, which answered its own 413.

Since Slice 6 (D-187) the API reads no upload before its guards. Only JSON (100 KB) is parsed before them. Each upload route reads its own body in its handler, with its own cap: media and a PowerPoint fact sheet 25 MiB, other documents 20 MiB, the import CSVs 5 MiB. An anonymous or unauthorised upload is answered 401 or 403 before a byte is read, and a declared length over the cap gets the API's 413. Each API process reads at most 2 uploads per person and 4 in all; past that it answers 503 with `Retry-After: 5`. The edge limits below still matter: they keep oversized and stalled bodies off the box before Apache and the API see them.

The SSH user cannot read or change Plesk's generated vhost configuration, so:

- **Someone with Plesk panel access**, in Domains > app.ampmverse.com > Apache & nginx Settings:
  - pastes [`plesk-nginx-directives.conf`](plesk-nginx-directives.conf) into "Additional nginx directives";
  - pastes [`plesk-apache-directives.conf`](plesk-apache-directives.conf) into both "Additional directives for HTTP" and "Additional directives for HTTPS";
  - Plesk tests the configuration before applying it.
  - If Plesk refuses the nginx file because `client_max_body_size` is a duplicate, the domain's "Maximum allowed HTTP request body size" field on the same page is set, and Plesk writes its own `client_max_body_size`. Use the field instead: set it to 32 MB (1 MB with the optional tier) and delete the file's `client_max_body_size` line, or clear the field and keep the line.
- **The required tier** is what those files apply as written. nginx takes at most 32m per request and waits at most 30 s between two reads of a body. Apache refuses a body over 32 MiB under `/_api`.
- **No `RequestReadTimeout` line.** Apache's slow-request timeouts stay the stock ones: mod_reqtimeout's `reqtimeout.conf` on Debian and Ubuntu sets `header=20-40,MinRate=500 body=10,MinRate=500`. A vhost line such as the first draft's `body=30,MinRate=500` would only loosen the body's timeout, and the client's own pauses are cut off by nginx's `client_body_timeout`.
- **The optional hardening tier** is commented out in the nginx file, with its steps. It keeps every other request to 1m and lets only the upload and import routes take 32m, with per-address request and connection limits. It needs the box's root admin twice:
  - to install [`nginx-upload-zones.conf`](nginx-upload-zones.conf) in nginx's http context;
  - to copy Plesk's own proxy lines from the generated vhost configuration into the new location block. Without them, uploads would stop reaching Apache.

**Check the edge** from any machine, before and after: `bash deploy/app-ampmverse/check-edge-limits.sh`, or with `--hardened` once the optional tier is on.

- It sends 40 MiB to an upload route, expecting the edge's 413 (the API's own answer, or a 502, means no edge limit), and 20 MiB, expecting the API's own 401 or 415.
- With `--hardened` it also sends 2 MiB of JSON to another API route, expecting the edge's 413.
- It sends no credentials, so nothing is stored, and it never calls a path behind the password curtain, whose 401s count toward fail2ban.

**The client's address (HF-G8).** With `TRUST_PROXY: "1"` behind Plesk's nginx and Apache, the API's rate limiter must count a request against the caller's real address, and must ignore an `X-Forwarded-For` the caller sends. Both held on 24 Nov 2026. Repeat the check after any change to Plesk's proxy settings or to `TRUST_PROXY`:

```bash
SHIP_SSH=app_ampmverse@31.97.62.74 SHIP_SSH_KEY=~/.ssh/ampm_test_vps bash deploy/app-ampmverse/check-client-ip.sh
```

It reads the limiter's counters for `POST /_api/auth/activate` over SSH, sends that route two empty requests, the second with a spoofed `X-Forwarded-For`, and reads the counters again. It prints `match` (as it should), `spoofable` or `differs`. It never prints an address.

## 8. Going live (when AMPM starts pitching clients)

The password curtain came off on 20 Nov 2026 (D-148); both sites are public and send `X-Robots-Tag: noindex, nofollow`. Going live means working through the list in [production-readiness.md](../../docs/planning/production-readiness.md), **switching the on-screen client code off ("Wiring SMS") first**, then removing the `X-Robots-Tag` lines (the curtain blocks are already commented out) from both production `.htaccess` files. Before that, confirm two things: `POST https://app.ampmverse.com/_api/auth/dev-login` with a well-formed body (`{"email":"nobody@example.com"}`) answers 404 (an empty body gets validation's 400 first: the route exists everywhere and refuses outside a local, non-production build), and the API runs with `NODE_ENV=production`. Both held on 20 Nov 2026.
