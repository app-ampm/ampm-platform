# Production readiness: the shared VPS

_Status: 20 November 2026. Production runs on the current VPS and serves app.ampmverse.com and site.ampmverse.com behind the curtain; the test stack is retired (D-138 to D-144). The runbook is [deploy/app-ampmverse/production-setup.md](../../deploy/app-ampmverse/production-setup.md)._

AMPM develops and works on production from now on, behind the password curtain. "Live" is the day the curtain comes off and clients are pointed at the website. Everything under section 3 must be closed first. The findings come from two audits on 20 November 2026: one of the live box, and one of the code on `main` at `bb2c0af`.

## 1. Decided (20 November 2026)

- **One server, production only (D-138, D-144).** Production (`ampm`) takes app.ampmverse.com and site.ampmverse.com. The test stack (`ampm-local`: dev sign-in, synthetic data, demos) was to move to test-app. and test-site.ampmverse.com; instead it is retired at the cutover (D-144): its containers stop, its volumes and source stay on the box, and demos run on the developer's machine. The box is in Mumbai: the Hostinger India range, with DE-CIX Mumbai as its upstream. That meets the India data-residency requirement.
- **Backups stay on the server for now (D-139):** an encrypted pgBackRest repository plus pre-deploy dumps and nightly media copies, all on this disk. Postgres runs under an init.
- **Secrets are box-only env files (D-140),** written by `prod-secrets.sh`, mode 600, never printed.
- **Production starts clean (D-141):** reference data only, plus an invited first Super Admin. The synthetic seed refuses to run in production.
- **Sign-in is AMPM's own (D-142):** staff password (Argon2id) + authenticator code (TOTP) + recovery codes, password reset by email, passwords throttled to 10 tries per 15 minutes per email and network, the account locked after 20 wrong codes in a row, admin authenticator reset; no Amazon Cognito.

## 2. Done

- [x] Stopped the test stack's database crash loop (19 Nov 08:51 → 20 Nov 05:49 UTC, a restart every ~10 s). The root cause is fixed in every Compose file (`init: true`).
- [x] Safety dump of the test database (`ampm-backups/pgdump`).
- [x] Production Compose override, deploy script (migrate before the API, safety dump, health gate, rollback), secrets helper, production `.htaccess` files with HSTS, security headers and a report-only CSP, and a target-aware web deploy that refuses to put a test bundle in production.
- [x] Reference-only bootstrap and the first-Super-Admin invite (`prisma/bootstrap.ts`), with e2e tests.
- [x] Production secrets generated on the box (database, Redis, backup cipher, media signing); Razorpay test keys copied.
- [x] **Production is running (20 Nov 2026):**
  - The API, worker and website ran first on `26387e5`. Since 10:46 UTC they run on `943ff61`: the website's Turnstile widget (D-145) and the clean shutdown (D-146). Each deploy passed the health gate.
  - The Resend sign-in and the Turnstile secret are verified, without sending mail or printing a value.
  - app.ampmverse.com and site.ampmverse.com serve production behind the curtain. `/_api` reaches the production API, and the dev sign-in routes answer 404.
  - The test stack is stopped, its volumes kept (D-144).
  - A nightly media archive is scheduled in the SSH user's crontab.

## 3. Before production runs (operator actions)

- [x] **Email through Resend (D-143),** 20 Nov: `ampmverse.com` verified in Resend (its DKIM and sending records added at GoDaddy through Domain Connect, the Google records untouched), the send-only API key stored as `SMTP_PASSWORD`, and `EMAIL_FROM` set to `AMPM <noreply@ampmverse.com>`.
- [x] **Cloudflare Turnstile,** 20 Nov: the widget "AMPM website" and its secret stored as `BOT_CHECK_SECRET` (rotated once after a paste went astray). The website widget itself is the enquiry-form item in section 4.
- [x] ~~Plesk + GoDaddy: test-app. and test-site.ampmverse.com~~: not needed, the test stack is retired (D-144).
- [x] **The first Super Admin,** activated on 20 Nov 2026: password, authenticator and ten recovery codes, with the first sign-in at 10:00 UTC, all audited. The one-time link file was deleted once its token was spent. Later staff are invited from the app.
- [ ] Keep an off-box copy of the backup cipher passphrase (`postgres.env`) in a password manager.

## 4. Before pitching clients (go-live blockers)

Identity and access
- [ ] **Client sign-in by mobile OTP** in AMPM's own sign-in (D-142): an API OTP service (the dev one exists; production needs hashed, rate-limited codes), the SMS transport through a DLT-registered provider (2Factor; registration takes 2–4 weeks, so start it now) and the client sign-in and activation screens. Until then clients, prospects and the demo cannot sign in on production.
- [x] ~~Invited staff cannot finish their first sign-in~~: solved by AMPM's own sign-in (D-142); the invitation link sets the password and the authenticator.
- [ ] Retire Cognito: remove the Cognito adapters, the Amplify screens and the pre-token Lambda, delete the AWS user pool, and update `docs/decisions.json` (Q13/Q14 name Cognito) with the generators.

Public forms and payments
- [x] ~~**Website enquiry form.** It sends a hard-coded `dev-bot-check` token, so production refuses every enquiry.~~ The form draws the Turnstile widget "AMPM website" and sends its token (Send waits for one; each token is spent once), the site key is the required build argument `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and the website's CSP admits `challenges.cloudflare.com` (`script-src`, `frame-src`) (D-145). Live since 20 Nov 2026 10:46 UTC, with the key in production's `compose.box.yml`.
- [ ] **Razorpay live:** KYC, the live key id, secret and webhook secret in `app.env`, a webhook registered to `https://app.ampmverse.com/_api/…`, and confirm auto-capture. Then make `env.ts` refuse `rzp_test_` keys in production.
- [ ] Rate limits on the unthrottled public and costly routes: client assistance requests, portal subscribe (creates an order on every call), uploads. Plus edge limits. Make the limiter fail closed rather than open on a Redis error.

Content and legal
- [ ] Privacy notice and terms (placeholders today; consent already cites versions "2026-10" and "2026-11"), a refund policy, and the contact channels.
- [ ] Real hotels, photos and verified rate cards loaded by the Hotel team.

Security and operations
- [ ] **A real antivirus scan.** `StubAvScanner` is wired on every upload path and only detects the EICAR test string; local production media is now allowed (D-106). Add a ClamAV adapter and refuse the stub in production.
- [ ] Enforce the portal CSP (switch Report-Only to enforcing once the console is clean in the live app).
- [ ] Error tracking (Sentry is listed in the secrets but read nowhere in the code), an external uptime monitor, and an API `/metrics` endpoint so the monitoring profile can start. Then the alert route.
- [ ] Log-table partitions end in January 2027 (`audit_events`, `notifications`), and no roll-forward job exists yet. Without one, rows land in the DEFAULT partition from February 2027.
- [ ] Off-box backups (D-139): S3 Mumbai (about ₹50–100 a month, needs approval under the ₹0-AWS rule), DigitalOcean Spaces Bangalore, or a second India machine. A first monthly restore rehearsal, recorded in the vault.
- [ ] **Tokens in link query strings reach the Plesk access logs** (D-142 security review, low): activation `?token=`, reset links, document and media links. Move them to the URL fragment (`#token=`), and shorten the staff invitation lifetime (7 days today). Under AMPM's own sign-in, an invitation link alone sets the password and the authenticator.
- [ ] Remove the sprint-2 `SpikeModule` (in-memory field notes) and the `/gallery` and `/field-notes` portal routes from production builds.
- [x] ~~The API and worker outlive Docker's 10-second stop~~ (fixed 20 Nov 2026; live since the 10:46 UTC deploy, after which the production worker stopped in 0.25 s with exit 143). The rate-limit store's Redis client was never closed, and node, PID 1 in the container, ignores the SIGTERM Nest re-raises after its hooks, so it waited on that socket until Docker's SIGKILL (exit 137). The client now closes in `onApplicationShutdown`. Prisma and the job queue close in the same phase, after the HTTP server has drained, so a request in flight keeps the database (before, Prisma reconnected for it and left that pool open). `api` and `worker` run under `init: true` with `stop_grace_period: 30s`; a local `docker compose stop` now ends in about a second (exit 143).
- [x] ~~Install `openssl` in `infra/docker/Dockerfile`~~ (done 20 Nov 2026 in the build and runtime stages; live since the 10:46 UTC deploy, whose migrate step no longer warned). The image build and `prisma migrate deploy` no longer warn that Prisma cannot detect OpenSSL.
- [x] ~~Next.js 16.4.3 carries seven moderate advisories~~, published 16–19 Nov 2026 and fixed in 16.4.5: GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8, GHSA-rhh4-g77r-r9qj, GHSA-vvgp-ww4w-46vf, GHSA-f3mh-rxg3-f5g2, GHSA-pc58-hwjq-p385 and GHSA-7qx7-33qx-rqx2. The website moved to 16.4.6 on 20 Nov. None applied to it as built: it has no `use cache`, cache components, route handlers, cookies or remote image hosts.
- [ ] A security review or penetration test, an accessibility pass and a load profile; then the launch checklist and the R17 go-live decision.

## 5. The server itself (needs the server owner: AMPM's SSH user has no root)

- [ ] **Patch and reboot.** 24 updates are pending, including a kernel 59 releases newer (6.8.0-90 → 6.8.0-149), and libc6 already needs a reboot. Schedule a window; both stacks restart on their own (`restart: unless-stopped`).
- [ ] **Co-tenancy (accepted in D-138, revisit before scale).** Another site's user (`app-32dentaldesign`) is in the `docker` group, which is equivalent to root and can read every AMPM volume. n8n is published on 0.0.0.0:5678. FTP (21) and the Zabbix agent (10050) face the internet. Ask the owner to firewall what AMPM does not need, or move AMPM to its own VPS (the original D-015 design; the repo's Compose files run there unchanged with Caddy).
- [ ] No swap is configured. With ~10 GB free this is fine today; add a small swap file if memory runs tight.
