# Sprint 5 feature brief — kernel finish

**For:** the development session (one developer + Claude Code) · **Date:** 28 October 2026 · **Status:** draft brief, awaiting the go before any code · **Phase:** the third and last identity-and-kernel sprint (build-plan §3, sprints 3–5); **finishes the kernel**.

This is a sprint brief, not a feature brief: it sets the sprint goal and holds one mini-brief per feature, each built with the method in [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md). Build the features **in the order below**, one worktree and one `pnpm check`-green merge per feature. Nothing is coded until the plan for the feature in hand is given and approved. Grounded in a survey of the current code (the five seams already exist from sprint 3/4 — this sprint turns stubs into real, contract-tested provider paths and closes the go-live gaps).

---

## 1. Where we start

Sprints 3–4 landed the kernel plumbing, the dynamic-RBAC foundation, and all of Module A's admin surface:

- **Kernel (PRs #3, #6, [[D-033]]/[[D-034]]):** typed `ConfigService` (the one typed config accessor, `CONFIG_REGISTRY` in `packages/core/src/schemas/config.ts`, auto-seeded); the BullMQ job runner + event bus (`apps/api/src/jobs/`, inline in dev/test, workers only when `JOB_WORKER`); the notification seam (`NotificationAdapter` + `ConsoleNotificationAdapter` stub + `NotificationService` + in-app delivery + preferences); server-side sessions keyed by the token `jti`; the audit-on-mutation pattern; monthly partitioning of `audit_events`/`notifications`; the **hourly session reaper** (`session-reaper.service.ts` — the model for any scheduled job).
- **Dynamic RBAC (PRs #7–#10, [[D-036]], [[D-038]]–[[D-040]]), dormant behind `DYNAMIC_ROLES`:** capability catalog, SA role/permission-set admin, audit read/export; per-request grant resolution.
- **Module A admin surface (PRs #11/#13/#14, [[D-041]]/[[D-042]]):** staff-user admin (5.1); invitation **activation** (5.2) — `POST /auth/activate`, link-on-activate with the mandatory verified-email match; client-login admin (5.3) with the Q5 partial-index cap. The invite/notification channel is wired to the **console stub**.
- **Identity seam:** `IdentityAdapter` (verify-only); `CognitoIdentityAdapter` (jose + `createRemoteJWKSet`) and `LocalIdentityAdapter`, env-selected by `IDENTITY_PROVIDER`.

Still fully local: native PostgreSQL 16, local Redis (optional — jobs run inline without it), synthetic seed, the local identity adapter, console/in-app notifications. **Two go-live gaps are now explicit:** (a) [[D-041]] — a stock Cognito **access** token carries no `email`, so against real Cognito the activation guard fails closed (403) for everyone until a verified email is on the token; (b) the email channel still delivers to a console stub, not a real provider.

## 2. Decisions to settle first (do this before any code)

Each is a build-decision record (`python3 docs/tools/new_decision.py "…" --area <area>`, `AMPM_VAULT` set in a worktree); the ones marked **(AMPM)** also need a business/account input.

1. **Cognito email-gap closure** — Pre-Token-Generation Lambda injecting `email`+`email_verified` into the access token (**recommended**: preserves the verify-only seam and the `jti`/session binding) vs verifying the Cognito **ID** token at activation (seam change). This is the central [[D-041]] go-live decision. Also: require `email_verified===true` for the match to be genuinely "verified".
2. **Email provider & SDK** — `@aws-sdk/client-sesv2` vs `nodemailer` + SES transport; dev sandbox = local SMTP catcher (Mailpit) vs SES sandbox mode. SES is the locked provider (T-4 / architecture §10). **(AMPM)** SES account + verified sending domain + production-access.
3. **Rate-limit mechanism & headers** — `@nestjs/throttler` + a Redis storage adapter vs a hand-rolled `ioredis` sliding window (ioredis is already a dep); `helmet` vs hand-set security headers; plus the Redis-outage policy (fail-open vs fail-closed).
4. **Session/CSRF model** — confirm the web client portal stays **Bearer** (CSRF-resistant, matches the [[D-033]] build) rather than cookie+SameSite (stale wording in architecture.md §12). This decides whether the authenticated API needs CSRF tokens at all (recommended: no; CSRF scope is the public site's unauthenticated forms only).
5. **Bot-check vendor** **(AMPM)** — Cloudflare Turnstile / reCAPTCHA / hCaptcha (architecture.md §12 marks it "AMPM to confirm"). Sprint 5 ships the adapter **seam only**; no public form exists yet (sprint 17).
6. **Demo baseline semantics** — reset strategy (re-seed vs diff-to-baseline; **recommend re-seed**), shared-single vs per-prospect demo project, and the **synthetic-data deletion exemption** (demo-restore hard-deletes `is_demo` rows without the Super-Admin approval that real-data retention jobs require — state this explicitly so it is not later read as a security-rule violation). **(AMPM)** OI-1 (demo duration/limits) and OI-2 (hotels per location) are still open; the mechanism ships on the R1 default ("three locations, one hotel each, no time limit").
7. *(Optional)* Formalise **jose** as the JWKS library of record (it is already the de-facto choice; do **not** add `aws-jwt-verify` or the AWS SDK for verification).

## 3. Sprint goal and exit

**Goal.** Finish the kernel: every Module A seam switched from stub to a real, contract-tested provider path, the platform hardened against abuse, the Cognito go-live gap closed, and demo data self-restoring — so the Phase-1 wedding-domain modules build on a complete kernel. `DYNAMIC_ROLES` stays off until an admin UI lands (a separate, later stream).

**Exit (all green under `pnpm check`):**
- Cognito offline JWKS **contract test** in CI; `email_verified` hardening landed; the activation email gap closed per decision 1 (code path + documented AWS-side config).
- Real-content, config-backed **notification templates** rendered per channel; a working activation link reaches the invitee.
- A real **email (SES) adapter** behind the existing interface with its mocked contract test as the always-on CI gate (a live SES-sandbox test wired but skip-gated on credentials).
- **Rate limits** on `POST /auth/activate` (per-IP + per-token), 429 `rate_limited` + `Retry-After`; a **nonce-based CSP** (no `unsafe-inline`) on `apps/web`; the **bot-check** and **API origin** seams in place.
- A worker-only nightly **demo-restore** job with a `job_runs` recorded outcome and a scoping-safety test proving non-demo rows are never touched.
- Every new dependency carries a D-record; **no external account blocks the sprint** — seams + offline/mocked tests ship regardless of R15, with live paths skip-gated until AMPM opens the accounts.

## 4. Before any code

- Settle §2's decisions and record them. Flag every new dependency (`@nestjs/throttler`/Redis store, `helmet`, the SES SDK, `aws-sdk-client-mock`, a bot-check SDK) as a build-decision per `.claude/rules/code.md`.
- **Establish the `*.contract.spec.ts` convention once** — it is shared by the Cognito, SES and bot-check adapters (§5.1, §5.3, §5.4). Offline/mocked by default so CI needs no secrets; a live variant `describe.skipIf`-gated on credentials (precedent: `bullmq.driver.ts` deferring its Redis contract test).
- `graphify query`/`explain` before grepping; read `.claude/rules/{api,security,data,code}.md`.

## 5. The features, in order

### 5.1 Cognito contract test + close the [[D-041]] go-live gap *(highest priority — unblocks real invites)*

The adapter already verifies tokens (`cognito.adapter.ts`, jose), but **no test exercises real JWKS/signature/issuer/aud/expiry** (only the pure `cognitoIdentityFromClaims` claim-shape is tested), and the email gap means activation can never succeed against real Cognito.

- Make the JWKS resolver **injectable** (it is built in the constructor today) so a test can verify offline against a local key; production unchanged.
- Require **`email_verified===true`** in `cognitoIdentityFromClaims` (treat `email` as absent otherwise → fail closed). Security-load-bearing for [[D-041]].
- **Offline JWKS contract test** (`cognito.adapter.contract.spec.ts`, the new convention): `jose.generateKeyPair('RS256')` + `exportJWK` + `createLocalJWKSet`; prove a good token verifies, and wrong issuer / wrong `client_id` / bad signature / expired / no-email / `email_verified:false` all behave correctly. This is the CI gate.
- **Close the gap** per decision 1 (Lambda or ID-token); extend `activation.service.spec.ts` with a Cognito-claims-shaped fail-closed-then-succeed case; document the Cognito pool / app-client / Lambda setup in `docs/engineering/`.
- *Optional, skip-gated:* a live Mumbai-sandbox test behind `COGNITO_*` env.
- Keep session identity bound to the **access** token's `jti` even if activation reads the ID token.

### 5.2 Notification templates

`renderBody(templateKey)` is a placeholder returning `[templateKey]`; `QueueNotification` carries **no variables**; the raw invite token is discarded (only its hash is stored), so **no working activation link can be rendered today** — the central design point.

- Add a **`notification.templates`** key to `CONFIG_REGISTRY` (templates are configurations rows, per api.md), modelling per-channel content: email `{subject, html, text}`, in-app `{title, body}`, sms/whatsapp `{providerTemplateId, params[]}` (provider-approved templates, not freeform), push `{title, body}`; baselines for `staff.invite`/`client.invite` (auto-seeded). Leave room for locale.
- A **pure renderer** in `@ampm/core` (`notification/render.ts`): `{{var}}` interpolation, **missing variables fail closed** (never emit `undefined` or a half-built link), **HTML-escape** interpolated values for the email `html` part (i18next runs `escapeValue:false`, so escaping is explicit). Reuse the existing i18next or a tiny internal interpolator — prefer **no new dependency**.
- **Carry per-notification variables** queue→send: add `variables?` to `QueueNotification`; capture the raw invite token at the `staff-users`/`client-logins` `queueInvite` call sites and build the activation-link variable; add an app/web **base-URL** env key. Decide where variables live between queue and send (job payload vs a new nullable `notifications` column — the latter is an expand-and-contract, partition-aware migration and turns the row into a bearer-credential store; **candidate D-record**).
- Wire `NotificationService.deliver` to render the channel's content before dispatch; grow `NotificationDelivery` from a single `body` to structured per-channel content (the shape §5.3's adapter consumes — **agree it before 5.3**). Keep the console stub's invariant: log channel+templateKey only, never body/recipient/token.
- *Optional:* validate template placeholders on config write (a bad `{{placeholder}}` edit → 400, not a broken send).

### 5.3 Real email (SES) sandbox adapter + per-channel registry

Only `ConsoleNotificationAdapter` exists and `notification.module.ts` binds **one** adapter for all channels — the per-channel factory the sprint-3 brief intended was never built. **Email (SES) is the only live provider this sprint**; WhatsApp/SMS/push stay on the console stub (unconfirmed providers T-4/Q11/A-11, accounts not open R15, push needs `device_tokens` + the native app — a mobile-sprint concern).

- Build the **channel→adapter registry** (env-selected, console fallback for every unconfigured channel), mirroring `identity.module.ts`'s env `useFactory`; `deliver()` resolves the channel's adapter. `NotificationResult`/`providerRef` unchanged.
- **Resolve the recipient address in the service**, not the adapter (`notifications` has no address column; adapters must not reach persistence) — extend `NotificationDelivery` with a resolved `address`.
- Implement **`SesEmailAdapter`** behind the interface (SDK imported only here); split a pure request-builder (like `cognitoIdentityFromClaims`) so command construction is testable without a live client; map SES errors to typed `@ampm/core` errors; return `MessageId` as `providerRef`; log channel+templateKey+providerRef only.
- Env (`EMAIL_PROVIDER` + SES settings, conditional `superRefine` mirroring the `COGNITO_*` block; default console in dev/test); from-address/reply-to/per-channel-enable as configurations rows; AWS creds via IAM/secret manager at runtime.
- **Contract test** (the convention): offline with `aws-sdk-client-mock` as the CI gate (correct `SendEmail` command, `MessageId`→`providerRef`, error mapping, no personal data logged); a live SES-sandbox variant `describe.skipIf`-gated on AWS creds. An e2e: an invite on the email channel reaches `sent` with a `providerRef` via the mocked adapter.
- *Defer unless explicitly in scope:* SES bounce/complaint webhook intake + suppression list.

### 5.4 Rate limiting + CSRF/CSP + bot-check seam

Nothing exists yet; the 429 `rate_limited` envelope is already wired (`errors.rateLimited`). The keys exist in `request-context` (ip, principal, requestId). There is **no API sign-in/OTP endpoint** (Cognito owns sign-in), so the live rate-limit target is `POST /auth/activate` now; the rest inherit the decorator later.

- A **rate-limit module** whose store degrades: Redis (via `REDIS_URL`, prod/staging) → in-memory (dev/test, matching the jobs pattern). Window/ceilings as configurations rows.
- A **custom guard** keyed per-IP **and** per-principal (IP-only for `@Public`), throwing `errors.rateLimited()` with `Retry-After`; a `@RateLimit` decorator mirroring `@RequirePermission`; registered as an `APP_GUARD` **before** `AuthGuard` so floods are rejected before JWKS verification.
- **`app.set('trust proxy', …)`** (env-driven, non-dev) so `req.ip` is the real client behind Caddy — the single biggest correctness risk (a wrong setting either collapses all clients into one bucket or makes `X-Forwarded-For` spoofable). This also fixes audit IPs.
- Apply limits: `POST /auth/activate` (per-IP **+** per-invite-token, to avoid shared-NAT lockout); `GET /health` exempt/generous.
- **Bot-check adapter seam** (interface + dev no-op stub + sandbox contract test, per api.md) ready for the sprint-17 public forms — **no form wired now**.
- **API origin guard** on public state-changing POSTs (the practical CSRF control for a Bearer API, reusing `CORS_ORIGINS`); document that the authenticated Bearer API needs no CSRF token (contingent on decision 4).
- **Next.js nonce-based CSP** (`apps/web/src/middleware.ts`, no `unsafe-inline`) + static security headers via `next.config.ts` `headers()`; HSTS stays with Caddy. A helmet-equivalent header pass on the API. Leave Caddy's own edge rate-limit/header config to the infra sprints.
- *Optional:* a `ZodHeaders` helper (security.md wants schema validation on headers; the activation controller parses `Authorization` by hand today).

### 5.5 Nightly demo-restore job

The job runner and the **session reaper** (the exact model to copy) are built; `recordScope` already derives `isDemo` from `user_type='demo'`. But the wedding-domain tables and their `is_demo`/`demo_visible` columns **do not exist yet**, so this is partly a skeleton — build the mechanism and safety rails now, expand-and-contract as domain tables land.

- A `job_runs` Prisma model for the **recorded outcome** api.md requires (the reaper only logs today) — status + per-table counts + error; update `docs/data-model.md` in the same task; migration + `pnpm db:generate`.
- A **demo baseline module** that the seed **and** the job both import (data defined once): a synthetic demo account (`user_type=demo`, example.com email, reserved phone range) + any `is_demo` kernel rows; structured as per-table specs so a future table is one entry.
- A **`DemoBaselineRepository`**: in one `$transaction`, per demo-scoped table delete `WHERE is_demo = true` (hotels: `demo_visible = true`) then re-insert the baseline — the guard **baked into the repository** so no caller can omit it; returns per-table counts; idempotent.
- A **`DemoRestoreService`** + `restoreDemoJob` modelled on the reaper: `onModuleInit` registers, then `if (JOB_WORKER) scheduleRepeatable('0 3 * * *')` (worker-only); `restore()` invokable on demand (dev/test have no Redis, so the schedule no-ops — the method must be callable or the job is untestable); writes a `job_runs` outcome; per-run idempotency key.
- **Tests** — the centerpiece is the **scoping-safety test**: a non-demo row beside a demo row in each scoped table; after `restore()` the non-demo row is untouched and the demo row equals baseline (extended by one row per new table, so the guard can never silently regress). Plus idempotency, transactional rollback, worker-only scheduling, and the recorded outcome. e2e modelled on `sessions.e2e-spec.ts`.
- **Biggest risk:** a reset statement missing its `is_demo`/`demo_visible` guard wipes real data irreversibly — the baked-in guard, the single transaction, and the safety test are the mitigations; consider refusing to run unless a demo-enabled flag is set (and PostgreSQL RLS later).

## 6. Cross-cutting

- **Contract tests:** one `*.contract.spec.ts` convention across Cognito/SES/bot-check; offline/mocked is the CI gate, live is skip-gated on credentials — **no external account blocks the sprint**.
- **Secrets & logging:** provider credentials in the secret manager, never in code/images/logs/fixtures; never log recipient addresses, bodies, tokens or the invite link — preserve the console stub's channel+templateKey-only pattern as `NotificationDelivery` grows.
- **Configuration, not code:** templates, from-addresses, rate-limit numbers, demo limits are configurations rows via `ConfigService` (the one typed accessor), not hardcoded.
- **Migrations** are expand-and-contract; `notifications` is monthly-partitioned, so any new column there is partition-aware; mirror schema into `docs/data-model.md` in the same task.
- **Client-facing content** (client.invite and later) interpolates only CLIENT/PUBLIC-class variables — never leak internal costs/margins (brief rule 8).
- `pnpm check` green, functions ≤40 lines, no `console.*`, named exports; the generated authorization + dynamic-roles suites stay green.

## 7. What this leaves ready

The kernel is complete: a real, contract-tested email path; templated notifications; abuse protection and web security headers; the Cognito identity path proven and its go-live gap closed; demo data that self-restores. Phase-1 wedding-domain modules (projects, CRM, hotels, budget, …) build straight on top. Going live stays an env/adapter swap, now with real providers behind the seams.

**Still deferred (named, not forgotten):** WhatsApp/SMS/push real adapters (await AMPM's provider confirmation + accounts, R15) and `device_tokens`/push registration (mobile sprint); the public lead/RSVP form screens + bot-check/CSRF **wiring** (sprint 17); guest-token-exchange + OTP flows (Phase 3); Caddy's edge rate-limit/header config (infra sprints 6–7); SES bounce/complaint intake + suppression list; the lossy `role_permissions` mirror retirement; an admin UI + `packages/api-client` hooks for dynamic RBAC (so `DYNAMIC_ROLES` stays off by default). FA's finance-conditioned and PM's per-project audit views + capability-driven field visibility still await subject-condition plumbing ([[D-037]], [[D-040]]).

## Appendix — external (AMPM / R15) dependencies

These gate the **live** path, not the sprint (offline/mocked tests + seams ship regardless):

- **SES:** AWS account, verified sending domain (DKIM/SPF/DMARC), production-access request.
- **Cognito (Mumbai):** the Pre-Token-Generation Lambda (or ID-token decision) so the token carries a verified email; and — since link-on-activate has **no** provisioning call on the seam — the operational step of creating the Cognito user at invite time.
- **WhatsApp BSP** (Meta verification + template approval, ~2–6 weeks) and **SMS** (DLT, ~2–4 weeks) provider confirmation + accounts — deferred.
- **Bot-check vendor** account (Turnstile/reCAPTCHA/hCaptcha).
- **Demo inputs:** OI-1 (duration/limits) and OI-2 (hotels per location).
