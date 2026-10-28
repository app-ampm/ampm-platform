# Sprint 3 feature brief — Module A kernel plumbing

**For:** the development session (one developer + Claude Code) · **Date:** 27 October 2026 · **Status:** draft brief, awaiting the go before any code · **Phase:** 1, the first of the identity-and-kernel sprints (build-plan §3, sprints 3–5).

This is a sprint brief, not a feature brief: it sets the sprint goal and then holds one mini-brief per feature, each to be built with the method in [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md). Build the features **in the order below** (each depends on the ones above it), one worktree and one `pnpm check`-green merge per feature. Nothing here is coded until the plan for the feature in hand is given and approved (CONTRIBUTING, "Before a feature", step 4).

---

## 1. Where we start

Bootstrap is done (D-017…D-023) and the 27 October hardening is merged (D-027…D-030, PR #2). What already exists for this sprint to build on:

- **Module A schema** — all 12 tables migrated (`apps/api/prisma/schema.prisma`, migration `…_module_a_identity_access_administration`), synthetic seed (`apps/api/prisma/seed.ts`). The `Notification`, `NotificationPreference`, `Configuration`, `AuditEvent` and `AuthToken` models exist but are **schema-only — no services wired**.
- **The permission pipeline** — `apps/api/src/policy/` has the 8-step guards (`AuthGuard`, `PermissionGuard`), `PrincipalService`, `recordScope()`/`isInScope()` (`db/scoping.ts`), `AuditService.record()` (append-only, masks RESTRICTED/SECRET), `EntitlementCache`, and the request-context `AsyncLocalStorage`. The policy model + generated authz suite live in `packages/policy` (`decide()`, `canTransition()`, `resources.ts`, `pnpm authz:generate`, CI drift-fail).
- **The identity seam** — `IdentityAdapter` interface + `IDENTITY_ADAPTER` DI token; `LocalIdentityAdapter` (dev tokens via `pnpm --filter api dev:token`, refused in production by `env.ts`) and `CognitoIdentityAdapter`, chosen by `IDENTITY_PROVIDER`. **This is the reference pattern every seam below copies.**
- **Live routes** — `GET /health`, `GET /me`. The `/spike/...` field-notes route is a throwaway to be deleted when real operational records land (not this sprint).
- **Shared packages** — `packages/core` (`errors`/`ERROR_CODES`, `logger`+`redact`, `parseEnv`, money, i18n, offline queue helpers), `packages/ui` (component library + Gallery), `packages/api-client` (`createApiClient`, `useMe`).

**The whole sprint runs locally with no external account:** native PostgreSQL 16 (`ampm`/`ampm_test`) + a local Redis, synthetic seed, the local identity adapter, and stub provider adapters. Going live later is an env/adapter swap, exactly as `IDENTITY_PROVIDER` already gates identity.

---

## 2. Decision check (do this first)

| Id | Status | Effect on this sprint |
|---|---|---|
| **Q13 / R10** staff sign-in = password + TOTP, clients = mobile OTP, all via **Amazon Cognito** | **Locked** 26 Oct | OTP/TOTP/passwords are the **identity service's**, not the API's (confirmed by the `AuthToken` model comment: *"OTP and passwords are the identity service's"*). The API mints **invitations and links** only. In dev the local adapter mints tokens directly, so there is no OTP step to build in the API. |
| **R5** two individually authenticated client accounts | Working decision | Session/principal model assumes two client accounts per wedding; safe to build. |
| **R9** final staff role list + who sees hotel/vendor costs | **OPEN (assumption)** | **Gates sprint 4, not sprint 3.** Sprint 3 plumbing (config, notifications, sessions, audit) is role-list-independent. Do **not** start user/role/membership **admin** (sprint 4) until R9 is settled, or the matrix work is rework. |

Sprint 3 is deliberately the slice that does **not** wait on R9.

---

## 3. Sprint goal and exit

**Goal.** The kernel *plumbing* every later feature stands on is live and local: a typed configuration accessor, a notification pipeline behind a provider-neutral adapter with a console stub and in-app delivery over a local BullMQ worker, server-side sessions wired into the request pipeline with idle timeouts and revoke-on-change, and an audit-on-mutation pattern.

**Demo / exit (close in the vault):**
1. `pnpm check` green; a new contract test per seam against its stub; the generated authz suite still green.
2. Reading a plan/price/label/feature-switch goes through **one typed `ConfigService`** (no literal constants in code).
3. Queuing a notification writes a `notifications` row, runs through the local worker, and the **console stub adapter** logs the "delivery"; an in-app notification is retrievable for its recipient; a disabled `NotificationPreference` suppresses the channel.
4. A request with a valid dev token creates/loads a **server-side session**; an idle session past its timeout (12 h staff / 30 d client) is refused; revoking the session (or changing the user's roles/memberships) ends it at the **next** request — proven with a fast/fake clock in a test.
5. A config change and a session revocation each write an `audit_events` row with actor, request id, before/after (masked).

**Out of scope this sprint (→ sprint 4–5):** user create/invite/activate/disable/list, role assign/revoke, membership invite/accept/remove (all R9-gated); invitation **accept** flow (AUTH-02); notification **templates** + real email/SMS/WhatsApp sandbox adapters + their contract tests; rate limiting, CSRF/CSP; the Cognito-sandbox contract test; the nightly demo-restore job; audit read/export endpoint.

---

## 4. Before any code

1. **Re-read the rules** for this work: `code.md` (always), `api.md`, `security.md`, `data.md`. No `ui.md`/`styling.md`/`offline.md` — this sprint is API + packages, no app screens (the settings/notification **screens** land with their sprints; here we ship the hooks/services they will consume).
2. **D-record first (new dependency category).** Redis + BullMQ (`bullmq`, `ioredis`) is a new category → `python3 docs/tools/new_decision.py "Job runner and event bus (BullMQ on Redis)" --area infra` (set `AMPM_VAULT` to the vault checkout when in a worktree) before adding the dependency. Record: BullMQ chosen (api.md already names it), idempotency-key + recorded-outcome + backoff + dead-letter policy, Redis local in dev, the production Redis is on the VPS.
3. **Reuse-first search** (`rg -i "<concept>" packages/ apps/api/src`) and report reused / extended / new. Expected reuse: `AuditService`, `PrismaService`, request-context (`requestId`, principal), `logger`+`redact`, `ERROR_CODES`/`AppError`, `@RequirePermission`/`decide()`, the `env.ts` Zod pattern, `ZodBody`/`ZodParams`, `EnvelopeInterceptor`.
4. **Doc-sync obligations** (same task as the code):
   - New permission keys → add to `docs/permission-matrix.md` **and** `packages/policy/src/resources.ts`, then `pnpm authz:generate` (CI fails on drift). Keys are `module.resource.action` (permission-matrix §10).
   - **New `Session` table** → add it to `docs/data-model.md` §3 first (schema mirrors the document, `data.md`), rebuild `field-matrix` (`python3 docs/tools/field_matrix_build.py`), then the Prisma model + migration.
   - `audit_events` and `notifications` are **partitioned by month from day one** (`data.md`) — the partitioning is a **raw SQL migration**, committed, never hand-edited after it runs. This sprint is where it lands (it was flagged outstanding in build-verification).

---

## 5. The features, in order

Each endpoint follows the CONTRIBUTING order: **Zod schema (`packages/core/src/schemas/<domain>.ts`) → permission key (`packages/policy`) → Prisma model → controller (thin) → service (rule + `decide()`) → repository (`projectScope`, demo flag, visibility, soft delete) → `packages/api-client` hook → tests next to code.** Response envelope `{ data }` / `{ error }`; one response model per audience, parsed through its schema so nothing else leaks.

### 5.1 Configuration accessor ("configuration, not code")

- **Why first:** smallest, no new deps, and notifications/sessions read their limits and templates from it.
- **Build:** `ConfigService` over the `Configuration` model (`config_key`, `value_json`, `scope`, `scope_id`) with **one typed accessor** per `config_key`, each value validated by a Zod schema in `packages/core/src/schemas/config.ts` (so a bad row fails loudly, not silently). Seed the keys this sprint needs (session idle timeouts, notification channel defaults, a sample feature switch). A read-through cache keyed on `config_key` with invalidation on write (mirror `EntitlementCache`).
- **Admin surface:** read is internal (used by other services); a Super-Admin-only write endpoint is optional this sprint — if included, gate with a `admin.configuration.update`-style key from the matrix and audit the write. (Reference-table editors — plans, lead sources, etc. — are sprint 4+.)
- **Tests:** Vitest — accessor returns the typed value, rejects a malformed `value_json`, cache invalidates on write; e2e 403 for a non-Super-Admin writer if the write endpoint ships.
- **Local↔live:** none — pure Postgres.

### 5.2 Job runner & event bus (BullMQ on Redis)

- **Why:** notifications, session expiry and every later background job need it (api.md: "Jobs (BullMQ): idempotent, with an idempotency key and a recorded outcome; retries with backoff; dead-letter…").
- **Build:** add `REDIS_URL` to `apps/api/src/env.ts` (optional in `test`, required when a queue is used) and `.env.example`; a `QueueModule` exposing a typed `enqueue(job, payload, { idempotencyKey })`; a worker entrypoint (`apps/api/src/worker.ts` or a `--worker` mode) that `pnpm dev --filter=api` can run; a thin **domain-event dispatcher** (in-process emit → handler enqueues a job) so cross-module reactions go through events (api.md: "a module never queries another module's tables; cross-module reactions go through domain events handled by the worker"). Every job records its outcome; dead-letter after configured attempts; nothing in Redis is the only copy of anything.
- **Tests:** Vitest — a job runs once per idempotency key (replay is a no-op), retries on throw, dead-letters after N; the dispatcher routes an event to its job. Use an in-memory/forced-immediate runner or a local Redis in CI.
- **Local↔live:** local Redis now; point at the VPS Redis via `REDIS_URL` later. No code change.

### 5.3 Notification seam (interface + console stub + service + in-app)

- **Why:** the greenfield unblocker; copies the identity seam exactly.
- **Build (the seam):** `NotificationAdapter` interface + `NOTIFICATION_ADAPTER` DI token returning a provider-neutral result; a **`ConsoleNotificationAdapter`** stub (logs the rendered message + returns a fake `providerRef`, dev/test default) and **empty stubs** for email/SMS/WhatsApp/push to be filled in sprint 5; a factory in a `NotificationModule` choosing the adapter per channel from config/env — same shape as `identity.module.ts`. **Business logic never imports a provider SDK** (api.md).
- **Build (the service):** `NotificationService.queue({ recipientType, recipientId, channel, templateKey, entity })` writes a `notifications` row (`status = queued`) and enqueues a send job (5.2); the worker renders (a trivial key→string renderer this sprint; real templates in sprint 5), calls the channel's adapter, and advances `status` queued→sent→delivered with `provider_ref`/`sent_at`. **In-app** channel is delivered in full (a row the recipient can read); other channels hit the console stub. A `NotificationPreference` row with `enabled=false` for `(userId, eventType, channel)` suppresses that channel.
- **Schema/doc:** land the `notifications` **monthly partition** raw-SQL migration here (`data.md`).
- **Permission:** a recipient reads only their own notifications (`own` scope); gate the list endpoint with the matrix key and `recordScope`.
- **Tests:** Vitest — service queues + persists; preference disables a channel; the stub adapter is called with the rendered payload; status transitions are `canTransition()`-guarded. Contract test: `ConsoleNotificationAdapter` satisfies the interface (the per-adapter contract test api.md asks for; real-provider contract tests arrive with those adapters in sprint 5). e2e: `GET` notifications returns only the caller's, 404-as-absence for another's.
- **Local↔live:** console/in-app now; point email→SES, SMS→DLT provider, WhatsApp→BSP, push→provider via config + Secrets Manager in sprint 5 / at go-live (R15 owns the accounts).

### 5.4 Server-side sessions

- **Why:** `security.md` requires server-side sessions with idle timeout and revoke-on-change — the token verification alone (built) does not satisfy it.
- **Design decision (recommended):** key a `Session` on the access token's `jti`. Add a `jti` claim to `LocalIdentityAdapter.mint()` (Cognito access tokens already carry one). `Session` fields: `id`, `userId`, `principalType`, `jti` (unique), `createdAt`, `lastSeenAt`, `idleTimeoutMinutes` (from `ConfigService`: 720 staff / 43200 client), `revokedAt`, `revokedReason`. Extend `AuthGuard` (after `verifyAccessToken`, before `PrincipalService` returns): load-or-create the session for the `jti`, refuse (`unauthenticated`) if `revokedAt` is set or `now − lastSeenAt > idleTimeout`, else bump `lastSeenAt`. **Revocation:** a reusable `SessionService.revokeAllForUser(userId, reason)` the role/membership mutations (sprint 4) will call; this sprint wires it to a manual revoke path + a test, and to membership/role **seed** changes so the pattern is proven. Guest-token→session exchange is sprint 3 only if cheap, else note for phase 3.
- **Doc:** add the `sessions` table to `docs/data-model.md` §3 (+ `field-matrix` rebuild) before the migration.
- **Tests:** Vitest/e2e — new `jti` creates a session; a second request reuses + bumps `lastSeenAt`; a session past idle timeout → 401; `revokeAllForUser` → next request 401; audit written on create + revoke. Use an injectable clock (do **not** use `Date.now()` directly — make it mockable) to test timeouts fast.
- **Local↔live:** none — the local adapter's token drives it exactly as Cognito's will.

### 5.5 Audit-on-mutation pattern

- **Why:** `AuditService.record()` exists but nothing calls it; `security.md` requires audit on create/update/delete/approve/share/export/restricted-read.
- **Build:** a small, explicit pattern (preferred over a magic interceptor so the before/after images are accurate) — a `recordAudit()` helper services call inside their transaction, pulling actor + `requestId` from the request context, masking RESTRICTED/SECRET via the existing `redact`. Apply it to the mutations shipped this sprint (config write, session revoke) as the worked examples; later features follow the pattern. The **audit read/export endpoint** is sprint 5.
- **Tests:** Vitest — a mutation writes exactly one append-only `audit_events` row with masked images, actor and request id; no business audit goes to application logs.
- **Local↔live:** none.

---

## 6. Cross-cutting

- **Tests matrix (`code.md`, CONTRIBUTING):** Vitest for `core`/`policy`/API services; supertest e2e for endpoints — 403 forbidden, 404 for a record the principal may not see (denial-equals-absence), 400 naming the field, 409 for a refused transition; a contract test per adapter against its stub; the generated authz suite always green. No app screens → no RNTL/Playwright/Maestro this sprint.
- **No new provider SDK in business logic; secrets only via env/secret manager; synthetic data only** (`security.md`, `data.md`).
- **Pre-merge (every feature):** diff vs `CLAUDE.md` + every rule file, each violation as file:line with the rule; then the invariants no linter sees — scoped repository on every project-owned query, every new permission from the matrix, data-model doc and schema agree, migrations expand before they contract.

## 7. Hardening backlog to fold in (cheap, local, on-path)

From `build-verification-2026-10-27.md`, the items that belong with this kernel work: the `audit_events`/`notifications` **monthly partition** raw-SQL migrations (done in 5.3/5.5); the data-model **standard columns / partial `deleted_at` indexes / soft-delete filter** so every query drops soft-deleted rows; and extend the authz suite to the §6 client/demo rows and §7 transitions if not already. Leave the broader sprint-2 backlog (per-package import boundaries, Node-24 hooks, CI dependency/secret scanning, mobile test runner) as its own chore unless it blocks a feature here.

## 8. What this leaves ready for sprint 4

With plumbing in place and R9 settled, sprint 4 builds the R9-gated admin surface on top: user create/invite/activate/disable/list, the invitation **accept** flow (AUTH-02, using `AuthToken` + the notification seam to send the link), role assign/revoke and membership invite/accept/remove — each writing audit (5.5), ending sessions on change (5.4), and reading limits from config (5.1). Sprint 5 finishes the kernel: notification templates + real provider sandbox adapters + their contract tests, rate limiting + CSRF/CSP, the Cognito-sandbox contract test, the audit read/export endpoint, and the nightly demo-restore job.

---

## Appendix — seams introduced this sprint and how they switch to live

| Seam | Local (this sprint) | Switch to live | Owner / lead time |
|---|---|---|---|
| Identity (already built) | `LocalIdentityAdapter` + `dev:token` | `IDENTITY_PROVIDER=cognito` + `COGNITO_*` | AWS/Cognito Mumbai (AMPM account) |
| Notifications | `ConsoleNotificationAdapter` + in-app | email→SES, SMS→DLT provider, WhatsApp→BSP, push→provider, via config + secrets | R15 open; WhatsApp/DLT 2–6 wk, AMPM's name |
| Jobs/events | local Redis (`REDIS_URL`) | VPS Redis (`REDIS_URL`) | VPS stack (plan sprints 6–7) |
| Sessions | local adapter token `jti` | Cognito token `jti` | no change |
| Config/audit | local Postgres | local Postgres (prod DB on VPS) | no change |
