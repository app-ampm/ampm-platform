# Production readiness: the shared VPS

_Status: 20 November 2026. Production runs on the current VPS and serves app.ampmverse.com and site.ampmverse.com publicly since 20 Nov 2026 (D-148: the password curtain is off, both sites send `noindex`); the test stack is retired (D-138 to D-144). The runbook is [deploy/app-ampmverse/production-setup.md](../../deploy/app-ampmverse/production-setup.md)._

AMPM develops and works on production from now on. The password curtain came off on 20 Nov 2026 (D-148); "live" is the day clients are pointed at the website and the `noindex` header comes off. Everything under section 3 must be closed first. The findings come from two audits on 20 November 2026: one of the live box, and one of the code on `main` at `bb2c0af`.

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
  - app.ampmverse.com and site.ampmverse.com serve production (behind the curtain until it came off later that day, D-148). `/_api` reaches the production API, and the dev sign-in routes answer 404.
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
- [ ] **Client sign-in by mobile OTP (D-147, Q13): built on 20 Nov 2026, SMS not wired yet.**
  - Built: active clients sign in, and invited clients activate, with a six-digit code to the mobile on file. Codes are kept as an HMAC, expire in 5 minutes, and burn after 5 wrong tries. A number is limited to 5 codes an hour and 10 a day, with a 30-second pause between codes. Unknown numbers get the same answer and no SMS. The code goes out through the notification pipeline, and the 2Factor and MSG91 transports are ready.
  - **Until a provider is wired, production shows each code on screen** (`CLIENT_OTP_SCREEN_ECHO=true`), so anyone who knows a client's mobile can sign in as that client. With the curtain off (D-148), **convert and invite no real client until step 5 below**: only test clients on AMPM's own numbers.
  - Left, in this order (runbook, "Wiring SMS"):
    1. DLT registration (2–4 weeks, so start it now).
    2. The provider account and its template.
    3. `SMS_PROVIDER` and the keys.
    4. A real SMS test.
    5. **`CLIENT_OTP_SCREEN_ECHO=false`, before any real client is converted or invited (D-148).**
  - Demo prospects (`user_type demo`) still have no production sign-in.
- [x] ~~Invited staff cannot finish their first sign-in~~: solved by AMPM's own sign-in (D-142); the invitation link sets the password and the authenticator.
- [x] ~~Retire Cognito: remove the Cognito adapters, the Amplify screens and the pre-token Lambda, and update `docs/decisions.json` (Q13/Q14 name Cognito) with the generators.~~ Done 21 Nov 2026 (D-153): the API's Cognito adapter and provisioner, the `COGNITO_*` settings, the Amplify sign-in and packages, and the pre-token Lambda source are gone; `IDENTITY_PROVIDER` is `ampm` (the default) or `local`, and a leftover `cognito` fails at boot. Q13/Q14 and the A-13, T-2 and T-6 notes record the change.
- [x] ~~**Delete the retired AWS resources** (the developer, in the AWS console): the user pool `ap-south-1_wcaro5oAK` with its app client, the `ampm-cognito-pretoken` Lambda with its execution role and log group, and any IAM user made for Cognito provisioning. Then check that the bill shows no Cognito charge.~~ Done 23 Nov 2026 (D-168).
  - Deleted: the pool, its app client, the Lambda, its role and its log group. No AWS account had IAM users or access keys, and the November bill was USD 0.
  - AMPM then left AWS. AutoPay is off, and all three accounts of its AWS Organization are closed; the root user closed the management account.
  - AWS can reopen the accounts until about 21 February 2027.

Public forms and payments
- [x] ~~**Website enquiry form.** It sends a hard-coded `dev-bot-check` token, so production refuses every enquiry.~~ The form draws the Turnstile widget "AMPM website" and sends its token (Send waits for one; each token is spent once), the site key is the required build argument `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and the website's CSP admits `challenges.cloudflare.com` (`script-src`, `frame-src`) (D-145). Live since 20 Nov 2026 10:46 UTC, with the key in production's `compose.box.yml`.
- [ ] **Razorpay live:** KYC, the live key id, secret and webhook secret in `app.env`, a webhook registered to `https://app.ampmverse.com/_api/…`, and confirm auto-capture. Then make `env.ts` refuse `rzp_test_` keys in production. A repeated purchase hands back its subscription's open order for up to an hour (D-149), and an order made under the test key cannot be paid with the live one, so switch when no test checkout is open, or wait an hour before buying again.
- [x] ~~Rate limits on the unthrottled public and costly routes: client assistance requests, portal subscribe (creates an order on every call), uploads. Make the limiter fail closed rather than open on a Redis error.~~ Done 20 Nov 2026 (D-149); live on production since 14:03 UTC that day (`53bba8d`). Every route a client, demo prospect or anonymous caller can reach now has a limit, per account and, for signed-in callers, per network (an IPv4 address or an IPv6 /64), and a CI test fails any new one without. Hotel-assistance requests: 20 an hour per client, 60 per network. Portal subscribe: 10 an hour per client, 30 per network, and a repeated purchase hands back the subscription's open order (unpaid, same price, under an hour old) instead of minting another. Uploads (gallery media, signed contracts, signed agreement copies): 30 a minute per member of staff, 90 per network. Client reads 300 a minute (1,200 per network), client writes 60 (300), `/me` 120, public document links 60 and media images 600 a minute per network; the health check is exempt. On a Redis error, sign-in, activation and password reset, and the costly routes (subscribe, assistance requests, uploads, the website enquiry) refuse with 503; reads, sign-out, the two payment confirmations and the Razorpay webhook let requests through, as before.
- [ ] **Edge limits** (needs the server owner): request-rate and connection limits in Apache for `app.` and `site.`, the backstop D-046 expected from Caddy. The upload routes buffer up to 26 MB before the API's guards run, so until then only Apache's limits bound an anonymous flood of large bodies.

Native apps (Q1 and R17: the iOS and Android apps launch with everything else)
- [x] **Native build setup (D-152), 20 Nov 2026:** one store app for staff and clients, `com.ampmverse.app` on iOS and Android, with development (`.dev`) and preview (`.preview`) variants that install beside it; iPad support switched on; the development client; EAS profiles in `apps/mobile/eas.json`. The first development builds ran on the iPhone 17 Pro and iPad Pro 13-inch simulators and the Pixel 7 emulator (Android 14), signed in against a local API. Getting there removed the unused WatermelonDB spike, whose Android code no longer compiles, and moved Expo's packages to SDK 58's expected patch versions (React Native 0.88.1); the drift had crashed the iOS app at launch.
- [ ] **An Expo account for AMPM,** then `npx eas-cli@latest init` in `apps/mobile`. The Expo CLI on the development Mac is signed in to another business's account; AMPM's project must not be created there (check with `npx eas-cli@latest whoami` first).
- [ ] **Apple Developer Program and Google Play Console accounts in AMPM's name** (risk question K6). Apple needs AMPM's D-U-N-S number and costs $99 a year; Google Play costs $25 once. Both take days to open.
- [ ] **Store listings:** name, description, phone and tablet screenshots, the privacy answers (App Privacy, Data safety), the age rating, and the support and privacy-policy addresses (the legal pages below).
- [ ] **AMPM's app icon and splash.** `apps/mobile/assets` still holds the Expo template's icons, so the installed app shows Expo's blue chevron.
- [ ] **A reviewer sign-in.** Apple and Google both need a working account to review the app, and today every way in needs an SMS code or an authenticator. Decide how a reviewer gets in.
- [ ] **First internal builds:** `eas build --profile preview`, then TestFlight and the Play internal track. Google Play takes the first upload by hand.
- [x] ~~**The retired Cognito code leaves the app before the first store build**~~ (D-153): `aws-amplify`, `@aws-amplify/react-native`, `react-native-get-random-values` and AsyncStorage are out of `apps/mobile`, so no native build carries them.
- [ ] **Export compliance** (`ITSAppUsesNonExemptEncryption`), answered at the first iOS submission once the encrypted offline store (D-026) is built.
- [ ] **Push notifications** (architecture §0): not built. Needs `expo-notifications`, an APNs key and Firebase Cloud Messaging.
- [ ] **A store-review allowance** of one to two weeks before every release in the plan (D-013).

Content and legal
- [ ] Remove the `X-Robots-Tag: noindex, nofollow` lines from both production `.htaccess` files at launch (D-148).
- [ ] Privacy notice and terms, more urgent now the public website takes enquiries (D-148) (placeholders today; consent already cites versions "2026-10" and "2026-11"), a refund policy, and the contact channels.
- [ ] Real hotels, photos and verified rate cards loaded by the Hotel team.

Security and operations
- [x] ~~**A real antivirus scan.**~~ Built 20 Nov 2026 (D-151). Every upload is streamed to ClamAV's clamd (`ClamAvScanner`, INSTREAM over TCP) and stored only if it comes back clean. An error or a timeout refuses the upload with a 503 (fail closed), and production refuses the stub. clamd runs alone on the internal network, and freshclam fetches the signatures over egress (runbook, "Antivirus"). **Live on production since 20 Nov 2026 14:09 UTC (`cfd98fe`):** the override carries `AV_PROVIDER: clamav` and `CLAMAV_HOST: clamav`. The smoke test passed: ClamAV 1.5.5, the EICAR PDF stream caught, a clean file OK, clamd at about 950 MB. The first start downloads 113 MB of signatures.
- [ ] Enforce the portal CSP (switch Report-Only to enforcing once the console is clean in the live app).
- [ ] Error tracking (Sentry is listed in the secrets but read nowhere in the code), an external uptime monitor, and an API `/metrics` endpoint so the monitoring profile can start. Then the alert route.
- [x] ~~Log-table partitions end in January 2027 (`audit_events`, `notifications`), and no roll-forward job exists yet. Without one, rows land in the DEFAULT partition from February 2027.~~ Done on 20 Nov 2026 (D-150, data-model §3 "Partition maintenance"); live on production since 14:03 UTC that day (`53bba8d`). Both tables have monthly partitions through December 2027.
  - Migration `20261120133309_partition_audit_notifications_2027` adds February to December 2027.
  - The daily worker job `admin.partitions.maintain` keeps the current month and the six after it, recording each run on `job_runs`.
  - If the DEFAULT partition already holds rows of a month, the job leaves that month uncreated, records the run as failed and logs an error. The fix is written in the data model.
  - Production was checked read-only on 20 Nov 2026: it runs in UTC and both DEFAULT partitions are empty.
- [ ] Off-box backups (D-139): S3 Mumbai, DigitalOcean Spaces Bangalore, or a second India machine. A first monthly restore rehearsal, recorded in the vault.
  - S3 Mumbai costs about ₹50–100 a month and needs approval under the ₹0-AWS rule.
  - AMPM closed its AWS accounts on 23 Nov 2026 (D-168), so S3 would also need a new AWS account under a different email address.
- [ ] **Tokens in link query strings reach the Plesk access logs** (D-142 security review, low): activation `?token=`, reset links, document and media links. Move them to the URL fragment (`#token=`), and shorten the staff invitation lifetime (7 days today). Under AMPM's own sign-in, an invitation link alone sets the password and the authenticator.
- [ ] Remove the sprint-2 `SpikeModule` (in-memory field notes) and the `/gallery` and `/field-notes` portal routes from production builds.
- [x] ~~The API and worker outlive Docker's 10-second stop~~ (fixed 20 Nov 2026; live since the 10:46 UTC deploy, after which the production worker stopped in 0.25 s with exit 143). The rate-limit store's Redis client was never closed, and node, PID 1 in the container, ignores the SIGTERM Nest re-raises after its hooks, so it waited on that socket until Docker's SIGKILL (exit 137). The client now closes in `onApplicationShutdown`. Prisma and the job queue close in the same phase, after the HTTP server has drained, so a request in flight keeps the database (before, Prisma reconnected for it and left that pool open). `api` and `worker` run under `init: true` with `stop_grace_period: 30s`; a local `docker compose stop` now ends in about a second (exit 143).
- [x] ~~Install `openssl` in `infra/docker/Dockerfile`~~ (done 20 Nov 2026 in the build and runtime stages; live since the 10:46 UTC deploy, whose migrate step no longer warned). The image build and `prisma migrate deploy` no longer warn that Prisma cannot detect OpenSSL.
- [x] ~~Next.js 16.4.3 carries seven moderate advisories~~, published 16–19 Nov 2026 and fixed in 16.4.5: GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8, GHSA-rhh4-g77r-r9qj, GHSA-vvgp-ww4w-46vf, GHSA-f3mh-rxg3-f5g2, GHSA-pc58-hwjq-p385 and GHSA-7qx7-33qx-rqx2. The website moved to 16.4.6 on 20 Nov. None applied to it as built: it has no `use cache`, cache components, route handlers, cookies or remote image hosts.
- [x] ~~The staff sign-in challenge counts a wrong code after comparing it, so authenticator guesses sent at once can exceed its five tries (the race the D-147 review found and fixed for client codes; behind the password, low).~~ Fixed 20 Nov 2026; live on production since 14:03 UTC that day (`53bba8d`). Each try is reserved on the challenge (`claimAttempt`) before the code or recovery code is compared, and a wrong one burns the challenge when it was the fifth (`burnIfSpent`), as client codes do. Twelve wrong codes sent at once now compare five times; the other seven are told the sign-in timed out, and only the five count toward the 20-in-a-row lock.
- [ ] Anyone can spend a client number's daily allowance of codes (10), blocking new codes for up to a day (an accepted trade-off of per-number limits, D-147). Consider an administrator's reset of a number's limits.
- [x] **The vault repository is private again** (23 Nov 2026, D-167; public since D-086). The vault sync now masks credentials in the session notes, which quote the user's messages, and refuses to commit a note the secret scan flags. What was public from 8 to 23 Nov 2026 may already have been copied. A scan of the vault's whole history found no secret, only public values (a Razorpay key ID and the Turnstile site key). This repository stays public, so section 5 keeps the server's specifics out of it.
- [ ] A security review or penetration test, an accessibility pass and a load profile; then the launch checklist and the R17 go-live decision.

## 5. The server itself (needs the server owner: AMPM's SSH user has no root)

The specifics (the other site's account, the exposed services and their ports, the pending packages) are in D-138 in the private vault, not here, because this repository is public (D-167).

- [ ] **Patch and reboot.** Security updates are pending, the kernel among them, and the server needs a reboot to finish them. Schedule a window with the owner; both stacks restart on their own (`restart: unless-stopped`).
- [ ] **Co-tenancy (accepted in D-138, revisit before scale).** Another site on this server has an account with root-equivalent access through Docker, so it could read every AMPM volume, and some of the server's own services face the internet. Ask the owner to firewall what AMPM does not need, or move AMPM to its own VPS (the original D-015 design; the repo's Compose files run there unchanged with Caddy).
- [ ] No swap is configured. With ~10 GB free this is fine today; add a small swap file if memory runs tight.
