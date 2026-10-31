# Sprint 4 feature brief — Module A admin surface

**For:** the development session (one developer + Claude Code) · **Date:** 28 October 2026 · **Status:** draft brief, awaiting the go before any code · **Phase:** the second identity sprint (build-plan §3, sprints 3–5); finishes Module A.

This is a sprint brief, not a feature brief: it sets the sprint goal and holds one mini-brief per feature, each built with the method in [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md). Build the features **in the order below** (each depends on the ones above it), one worktree and one `pnpm check`-green merge per feature. Nothing is coded until the plan for the feature in hand is given and approved.

---

## 1. Where we start

The sprint-3 kernel and the dynamic-RBAC admin surface are landed and merged:

- **Kernel (PRs #3, #6):** the typed `ConfigService`, the BullMQ job runner + domain-event bus, the notification seam (`NotificationAdapter` + console stub + `NotificationService` + in-app + preferences), server-side `sessions` keyed by the token `jti` with idle-timeout and `SessionService.revokeAllForUser(userId, reason)` ([[D-033]]), and the audit-on-mutation pattern. Hardening: transactional config audit, the session reaper, monthly partitioning of `audit_events`/`notifications` ([[D-034]]).
- **Dynamic RBAC (PRs #7–#10, [[D-036]], [[D-038]]–[[D-040]]), dormant behind `DYNAMIC_ROLES`:** the code-defined capability catalog (`grantable_capabilities`), the SA role-admin surface (custom-role CRUD + **user-role assign/revoke** — `POST`/`DELETE /admin/users/:id/roles`, already built in 6a), reusable permission sets + attach-to-role, and audit read/export. Per-request grant resolution injects a custom role's capabilities as `PolicyPrincipal.resolvedGrants`.
- **Identity seam:** `IdentityAdapter` + `IDENTITY_PROVIDER`; `LocalIdentityAdapter` (dev `pnpm --filter api dev:token`) and `CognitoIdentityAdapter`. `AuthGuard` → `PrincipalService` resolves the principal (staff/client/demo/system) with memberships; `recordScope()`/`isInScope()` turn a decision's scope into a query filter.
- **Module A tables:** all migrated. `users`, `user_roles`, `project_members`, `sessions`, `audit_events`, `configurations`, `notifications` are wired; **`auth_tokens` is schema-only — no service** (purposes `invite` / `password_reset` / `otp` / `magic_link`).

Still runs fully local: native PostgreSQL 16, local Redis, synthetic seed, the local identity adapter, console/in-app notifications. Going live stays an env/adapter swap.

---

## 2. Decision check (do this first)

| Id | Status | Effect on this sprint |
|---|---|---|
| **R9** final staff role list + cost visibility | **Settled** ([[D-035]]) — the nine roles are the baseline | Unblocks this admin surface. The cost-visibility *defaults* remain AMPM's residual business call, but they do not gate user/login admin. |
| **Q13 / R10 / identity = Amazon Cognito** | **Locked** 26 Oct | OTP/TOTP/passwords are the identity service's. The API mints **invite / link** tokens only (`auth_tokens`). See the **open decision** below on how a user acquires a Cognito `identity_subject`. |
| **R5 / Q5** two client accounts per wedding, one per side | Working decision | `admin.client_logins` creates a `project_members` `client_representative` row with `client_side` (bride/groom), `can_view_finance` (pending Q4), `can_approve`. |
| **DYNAMIC_ROLES flag** | off by default | Staff-user admin and **system-role** assignment are flag-independent. A **custom-role** assignment only *resolves* when the flag is on — so this sprint is correct with the flag off; custom roles simply stay inert until it is enabled. |

**Open decision to settle in feature 1's plan (D-record):** how a newly-invited staff/client user gets a Cognito `identity_subject`. In dev the local adapter just mints a token for a subject, so activation sets `identity_subject` + `status=active` directly. In production the choices are (a) grow the `IdentityAdapter` with a `provisionUser`/`inviteUser` method that creates the Cognito user when AMPM invites, or (b) link `identity_subject` on first Cognito sign-in. Pick one before coding the accept flow (feature 2); the local adapter makes everything testable either way.

---

## 3. Sprint goal and exit

**Goal.** Finish Module A: a Super Admin can create, invite, activate, update and disable **staff users**; invited users **activate** through a tokened accept flow (no self-registration, A-13); and SA/SM (and PM, for their projects) can administer **client logins** — each writing audit, ending sessions on change, reading limits from config, and reusing the role-assignment endpoints already shipped.

**Demo / exit (close in the vault):**
1. `pnpm check` green; a contract test per new seam; the generated authz suite and the dynamic-roles suite still green.
2. SA creates a staff user → row is `status=invited`, an `auth_tokens` `invite` row is minted, and the notification seam queues the invite (console stub in dev). SA lists/reads staff; any staff role can read the directory; a non-SA cannot create (403, since all staff hold `admin.staff_users.read`).
3. The invited user exchanges the invite token → `identity_subject` linked, `status=active`; the token is single-use and expiring; a second use is refused. A disabled user's sessions end on the next request.
4. SA assigns a (system or custom) role to the activated user via the existing `POST /admin/users/:id/roles`; with `DYNAMIC_ROLES` on, a custom role resolves on their next request.
5. SA/SM create a client login for a project (a `client_representative` with side + finance/approve flags); PM can do the same **only** for an assigned project (404-as-absence elsewhere); SA can delete a client login. Each client create reuses the invite/accept flow.
6. Every mutation writes one `audit_events` row (actor, request id, before/after masked); a status/role/membership change calls `SessionService.revokeAllForUser`.

**Out of scope (→ later):** staff **project team-assignment** (`project_members` for staff) — it has no Module A capability and lands with **Module E** (wedding project, §7); `password_reset` / `magic_link` token flows; real email/SMS provider adapters (sprint 5); the admin **UI** + `packages/api-client` hooks beyond what each feature needs (the screens land with their app sprint); rate limiting / CSRF / CSP; retiring the lossy `role_permissions` mirror.

---

## 4. Before any code

1. **Re-read the rules:** `code.md` (always), `api.md`, `security.md`, `data.md`. No `ui.md`/`styling.md` — API + packages only this sprint.
2. **D-record first** for the identity-provisioning decision (§2 open decision) before the accept flow: `python3 docs/tools/new_decision.py "Staff and client identity provisioning on invite/activation" --area permissions` (set `AMPM_VAULT` when in a worktree).
3. **Reuse-first search** (`rg -i "<concept>" packages/ apps/api/src`) and report reused / extended / new. Expected reuse: `users`/`project_members`/`auth_tokens` models, `IdentityAdapter`, `NotificationService` (invite delivery), `SessionService.revokeAllForUser`, `AuditService` + `@SelfAudited`, `@RequirePermission` + `recordScope`/`isInScope`, `capability-grants` guard helpers, `ZodBody`/`ZodParams`/`ZodQuery`, `EnvelopeInterceptor`, the `RolesController` assign/unassign endpoints.
4. **Doc-sync obligations (same task):** the permission keys already exist (`admin.staff_users.*`, `admin.client_logins.*`) — no matrix change expected; if any new key appears, add it to `docs/permission-matrix.md` + regenerate (`pnpm authz:generate`, CI drift-fails). `auth_tokens` is already in `docs/data-model.md` §3 — wiring its service needs no schema change. Any field change → data-model first, then `field_matrix_build.py`, then Prisma.

---

## 5. The features, in order

Each endpoint follows CONTRIBUTING: **Zod schema (`packages/core/src/schemas/<domain>.ts`) → permission key (exists) → controller (thin) → service (rule + `decide()`/scope + audit + revoke) → repository (`projectScope`, soft delete) → `packages/api-client` hook → tests next to code.** Envelope `{ data }` / `{ error }`; one response model per audience.

### 5.1 Staff-user administration (`admin.staff_users.*`)

- **Why first:** the role-assignment endpoints (6a) already act on `users`; this completes the user record they assign to.
- **Build:** a `StaffUsersModule` under `apps/api/src/modules/admin/staff-users/`. `GET /admin/staff-users` (list, cursor-paginated, `admin.staff_users.read` — held by all staff) and `GET /admin/staff-users/:id`; `POST /admin/staff-users` (SA) creates a `user_type=staff` row `status=invited` (**as built:** the `invite` token + `NotificationService` send are deferred to feature 5.2, which owns the `AuthTokenService` and activates the user — 5.1 is the record lifecycle only; the `api-client` hook + screen are deferred too, no UI consumer yet); `PATCH /admin/staff-users/:id` (SA) updates name/phone and mirrors `mfa_enabled`; `DELETE` or a `status` transition disables (SA) — soft, and calls `revokeAllForUser`. Role assign/revoke is **not re-built** — the 6a endpoints stand.
- **Guardrails:** SA-only mutations; all-staff read; `status` moves are `canTransition()`-guarded (`invited→active→disabled`); audit every mutation; never expose `identity_subject`/token hashes in a view (RESTRICTED).
- **Tests:** Vitest service (create mints token + queues invite; disable revokes sessions; status transitions guarded) + e2e (SA creates; non-SA create → 403; read as a non-SA staff → 200; disabled user's next request → 401).

### 5.2 Invitation & activation (AUTH-02) — the `auth_tokens` service

- **Why:** features 5.1 and 5.3 both put a user in `status=invited`; this is how they become `active` without self-registration (A-13).
- **Build:** an `AuthTokenService` over `auth_tokens` (`invite` purpose this sprint): mint (hashed token, `expires_at` from config, one live token per purpose per user), and a **public, token-authenticated** `POST /auth/activate` that verifies the token (unexpired, unused), links the `identity_subject` per the §2 decision, sets `status=active`, marks the token `used_at`, and audits it. Idle/limits from `ConfigService`. This is **not** `@RequirePermission`-gated — it authenticates by the token itself.
- **Local↔live:** dev local adapter links a `local:<handle>` subject directly; production follows the provisioning decision (§2). Invite delivery is the console stub now, email in sprint 5.
- **Tests:** Vitest (mint is single live token; verify rejects expired/used) + e2e (activate links subject + flips status + marks used; replay → 409/invalid; expired → refused).

### 5.3 Client-login administration (`admin.client_logins.*`)

- **Why:** clients are `users` (`user_type=client`) + a `project_members` `client_representative` row (Q5: two per wedding, one per side); this is their access admin.
- **Build:** endpoints under `/admin/projects/:projectId/client-logins` (so the `projectParam` drives the `assigned` scope): `POST` (SA/SM any project, PM assigned) creates the client user `status=invited` + the `project_members` row (`client_side`, `can_view_finance` pending Q4, `can_approve`) and reuses 5.2 to invite; `GET` list/read (SA/SM all, PM assigned); `PATCH` updates the membership flags/side; `DELETE` (SA only) removes the login. The repository scopes every query with `recordScope` (assigned → `projectId ∈ memberships`); denial is absence (404).
- **Guardrails:** enforce the Q5 cap (at most two representatives per wedding, one per side) as a `409`; audit every mutation; `revokeAllForUser` on disable/removal; a client view never carries internal/cost fields (`security.md`).
- **Tests:** Vitest service (scope mapping, the per-side cap) + e2e (SA/SM create; PM create on an assigned project → 201, on another → 404; PM delete → 403 since delete is SA-only; the second same-side rep → 409).

---

## 6. Cross-cutting

- **Tests matrix:** Vitest for `core`/`policy`/API services; supertest e2e — 403 forbidden, 404 denial-as-absence, 400 naming the field, 409 for a refused transition/cap; a contract test for any new adapter method (identity `provisionUser` if chosen); the authz + dynamic-roles suites always green.
- **No provider SDK in business logic; secrets via env/secret manager; synthetic data only.**
- **Pre-merge (every feature):** diff vs `CLAUDE.md` + each rule file (violations as file:line); then the invariants no linter sees — scoped repository on every project-owned query, every permission from the matrix, data-model/schema agree, migrations expand before they contract, audit on every mutation, sessions revoked on access change.
- **Reviews:** each feature gets the same adversarial pass phase 6 used (an escalation/over-exposure lens is mandatory for anything touching `users`/logins).

---

## 7. What this leaves ready

With Module A complete, the platform has a full "who can use the system, and as what" story end-to-end: create a staff member → invite → activate → assign a (system or custom) role → it enforces; stand up a client's portal login per side. That unblocks **turning `DYNAMIC_ROLES` on** behind an admin UI, and **Module B — CRM, subscriptions & commercial agreements** (Razorpay subscriptions per R2/R3), which needs these accounts. Staff project team-assignment arrives with **Module E**.

---

## Appendix — seams this sprint touches and how they switch to live

| Seam | Local (this sprint) | Switch to live | Owner / lead time |
|---|---|---|---|
| Identity provisioning | local adapter links `local:<handle>` on activate | Cognito `provisionUser`/invite **or** link-on-first-sign-in (§2 decision) | AWS/Cognito Mumbai (AMPM account) |
| Invite delivery | `ConsoleNotificationAdapter` + in-app | email→SES (sprint 5) | R15 open |
| Sessions / audit / config | local Postgres | prod DB on VPS | no change |
