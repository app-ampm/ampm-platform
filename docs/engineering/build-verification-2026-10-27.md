# Build verification, 27 October 2026

This records a check of main at d176d1a: the v0.1.0 skeleton plus the sprint 2 offline spike. It was checked against `docs/engineering/standards.md`, the rule files in `.claude/rules/`, the build plan's §11 and the build-decision records D-013 to D-026. The developer decides what follows from it. Nothing in the code was changed by the verification.

The check had two passes:

- **A fresh clone from GitHub, set up by the root README** on throwaway databases. It covered install, generate, deploy, seed, `pnpm check` with no cache, the drift check, the builds, the iOS and web bundles, the built API run live, and the two Claude hooks.
- **A multi-agent audit.** Eight reviews, one per rule area, were followed by five gap reviews that a coverage critic named. An adversarial verifier re-checked every high and medium finding on its own and the lows in batches. The audit produced 240 findings. I re-read seven of the confirmed ones at their cited lines, and all seven held.

## Verdict

The execution is not yet excellent, so the next phase should wait for a short hardening pass.

What holds:
- The toolchain, the gates and the tests are real. `pnpm check` runs 27 tasks with no warnings, the generated authorisation suite runs 6,634 cases, the drift check is clean, and CI is green on main.
- The built API behaves as documented for health, `/me`, token rejection, the error envelope, validation at the edge and request ids.
- The dependency direction holds in the actual imports. There is no `any`, no ignored type error and no oversized file or function.
- The audit found no committed secret in either repository.

What does not hold:
- **The mobile web app has been down since the offline spike merge.** Every route answers 500 and the web export fails. CI never bundles the mobile app, so the merge went green.
- **The README's new-machine setup fails at three steps.** The migration and the API's run command ignore `apps/api/.env`, and Prisma's own seed command lacks the TypeScript loader.
- **The permission engine departs from the permission matrix in ways sprint 3 builds on directly.** Finance may close a wedding. Conditions such as "with explicit grant" are dropped, so every RG and HL member reads identity documents. A multi-role user can lose access by gaining a role. The reports and exports table is skipped. The generated suite never iterates the client, demo or transition rows, so none of this fails CI.
- **The request pipeline answers denial as 403, not 404,** and the guard cannot evaluate own scope. Repository scoping copies the role list from policy and has no caller. A soft-deleted role still grants its permissions.
- **A GitHub OAuth token for the amardeep-ideonovo account sits in one MemPalace drawer** and in two lines of session 6d9c1b45's transcript. It is in neither repository, in their files or their history. The hooks would re-file it from the transcript after a deletion.
- **Several handover claims in D-022 and D-023 overstate what was built.** These include audit columns on every table, partial indexes, the soft-delete extension, ThemeProvider tests, the app READMEs and the hooks running on Node 24.

## Defects from the fresh clone

| # | Severity | Defect | Also in the audit |
|---|---|---|---|
| 1 | Critical | The Expo web app answers 500 on every route and `expo export --platform web` fails. expo-sqlite's web worker imports `wa-sqlite.wasm`, which Metro cannot resolve, and the dynamic import in `create-store.ts` does not keep it out of the web graph. | Missed |
| 2 | High | `pnpm --filter api db:deploy` and the root `pnpm db:migrate` ignore `apps/api/.env`. `prisma.config.ts` falls back to the placeholder URL and fails with P1010. CI passes only because the workflow sets `DATABASE_URL`. | Missed |
| 3 | High | `pnpm dev --filter=api` exits at once, because `nest start` does not load `apps/api/.env`. | PLAN-06 |
| 4 | Medium | The seed command in `prisma.config.ts` lacks `--import tsx`, so `prisma db seed` fails, and so does the seed that runs after `migrate dev` or `migrate reset`. | Missed |
| 5 | Medium | PermissionGuard answers 403 when a project manager asks for another project's records. Denial must equal absence, a 404. | API-01 |
| 6 | Low | The engines field (22.13 or newer) is not enforced and disagrees with `.nvmrc` 24. Node 20 fails in `prepare` with a cryptic error. | TOOL-19, as information |
| 7 | Low | There is no `apps/mobile/.env.example`, although the README documents its variables. | PLAN-14, as information |
| 8 | Low | The API sends `X-Powered-By: Express` and no security headers. | GAP3-06, web only |
| 9 | Process | CI builds only web and api. The mobile bundle is never built, and the spike merge was verified with `pnpm check` alone. | PLAN-02 in part |

## Fix before the next phase

1. **The leaked token.** The developer rotates or revokes the amardeep-ideonovo token on GitHub. Then delete the drawer, scrub the two transcript lines and add a secret-pattern filter to `docs/tools/memory_hook.sh` (GAP5-16).
2. **The web app and CI.** Add a `create-store.web.ts` platform file that never reaches expo-sqlite, then add `expo export` for web and iOS to CI (defects 1 and 9).
3. **The new-machine setup.** Make deploy, migrate, seed and the API dev command load `apps/api/.env`. Put the ports 3417 and 8082 in the scripts and replace the web app's scaffold README. Re-run the README on a clean clone (defects 2 to 4, PLAN-06, PLAN-07, APPS-08).
4. **The permission engine and its suite**, since sprint 3 identity uses it on every request: POL-03, POL-01, POL-04, POL-05, POL-06, POL-07, POL-08, POL-09, POL-10, POL-11 and POL-13. Then extend the generated suite to the §6 client and demo rows and the §7 transitions (TOOL-06), so drift fails CI.
5. **The request pipeline:**
   - Denial as 404 by default (API-01) and own scope at the guard (POL-16).
   - Scoping read from policy, with a caller (API-02, CODE-03).
   - The soft-deleted role filter (DATA-04, GAP4-01).
   - Error mapping for server-side Zod failures and body-parser errors (API-04, API-05, GAP1-11).
   - Audit masking of camelCase keys (DATA-11).
   - Tests for the guard, audit, scoping and the entitlement expiry (API-11).
6. **iOS screen-reader announcements** for errors, danger callouts and toasts (UI-01).

## Fold into the rest of sprint 2

- **Data model:** the standard columns, partial indexes and the soft-delete extension, or a D-record that replaces them (DATA-01, DATA-02, DATA-03, GAP4-04). Also the entity-type checks, the audit actor's delete rule, the request-id length, and the field matrix rebuilt after the `identity_subject` change (DATA-07, DATA-10, GAP4-02, DATA-08).
- **Enforcement:** per-package import boundaries (CODE-01, PLAN-09, TOOL-02), the hooks on Node 24 (PLAN-10, TOOL-05), the stale template lint exemption (UI-05) and the undeclared mobile dependencies (CODE-07).
- **CI:** dependency and secret scanning with Dependabot (GAP3-07, TOOL-09), and a merge through a pull request that waits for green (PLAN-02).
- **Tests:** a test runner in apps/mobile with the account screen's states (APPS-06, TOOL-08), and tests for ThemeProvider, the UI hooks and useMe (TOOL-07). Also add the missing test for the web animation fix (GAP5-11).
- **Offline spike, before the real store reuses it:** the idempotency key collision that D-026 keeps (APPS-03), the silently dropped conflicts and stalled queue (APPS-01), and the missing error state (APPS-02). Code review and security review then run on the sync code (PLAN-03).
- **UI and apps:** `supportsTablet` for iPad builds (APPS-05), refs on focusable components (UI-02), the font-scaling cap (GAP2-01), the typed-routes cast in Link (CODE-06), the i18n wiring for app screens (CODE-02), the duplicated types (CODE-04) and the definition-of-done JSDoc (CODE-05).
- **Records:** the sprint demo note with the measured pace (PLAN-04), the `docs/adr` mirror or a record withdrawing it (GAP5-09), and a graph refresh after every code change (GAP5-10).

## Audit scores

| Review | Score out of 10 | Scope |
|---|---|---|
| CODE | 6.5 | General engineering rules (layout, dependency direction, reuse, architecture, code standards) |
| UI | 7 | UI library and styling rules |
| API | 6 | API, pipeline and security rules |
| DATA | 6 | Data model: Prisma schema and migration against the data model and the data rules |
| POLICY | 5 | Permission matrix as code and the generated authorisation suite |
| TOOL | 6 | Tooling, tests, hooks and CI |
| PLAN | 6 | Plan conformance, decision records and documentation accuracy |
| APPS | 6 | Offline spike and the two apps |
| GAP1 | 4 | GAP1 Regression tests for the security controls in reachable API and client code |
| GAP2 | 6 | GAP2 Screen-level accessibility, font scaling and error presentation in the shipped screens |
| GAP3 | 6 | GAP3 Web delivery and browser security posture: CSP, inline scripts, rendering mode and hosting |
| GAP4 | 7 | GAP4 API module architecture, repository layering and configuration as data |
| GAP5 | 5 | GAP5 Enforcement wiring and change records: rule globs, D-records before patterns, ADR mirror, graph currency, … |

## Confirmed high findings (3)

| ID | Finding | Where | Fix |
|---|---|---|---|
| GAP5-16 | A GitHub OAuth token is filed in the MemPalace wing ampm | `~/.mempalace/palace/chroma.sqlite3 drawer …` | Have the developer rotate or revoke the amardeep-ideonovo gh token. |
| POL-03 | Transition parser widens authority: FA may close a project, and 'any open state' or 'any active' match closed records | `packages/policy/scripts/generate.ts:125,139-142` | Parse role codes only from the part before the condition, cutting at ', only when', ', when', ', with' or ';'. |
| UI-01 | Errors, the error state, danger callouts and toasts are not announced on iOS | `packages/ui/src/components/input/input.tsx:55-56` | Add a small `useAnnounce(text, when)` hook in packages/ui that calls AccessibilityInfo.announceForAccessibility on iOS when an error, alert callout or toast appears, keeping the live region for Android and role alert or status … |

## Confirmed medium findings (61)

| ID | Finding | Where | Fix |
|---|---|---|---|
| API-01 | PermissionGuard answers 403, not 404, when the principal may not see the project (denial equals absence is opt-in) | `apps/api/src/policy/permission.guard.ts:36` | Make 404 the guard's default for not_assigned and not_owner. |
| API-02 | Step 5 repository scoping is unused, lacks the visibility filter and derives scope from a hard-coded role list instead of the matrix | `apps/api/src/db/scoping.ts:13-26,17,29-31` | Build the scope from the permission key's resolved scope (decide()'s scope) and the policy package. |
| API-04 | Server-side response-schema failures are reported to the client as 400 validation_failed | `apps/api/src/common/app-error.filter.ts:43-49` | Map ZodErrors to validation_failed only when they come from the edge pipes. |
| API-05 | Over-limit request body answered 500 internal and logged at error level; unmapped 4xx get validation_failed with a mismatched status | `apps/api/src/common/app-error.filter.ts:41-58 (line 57 and line 53)` | Handle errors carrying status or statusCode below 500 (as Nest's BaseExceptionFilter.isHttpError does): map 413 to validation_failed with status 400, or add a payload_too_large code. |
| API-11 | No tests for PermissionGuard, AuditService, projectScope or the entitlement TTL; the e2e suite has no 403/404 tamper case | `apps/api/test/api.e2e-spec.ts:26-96` | Add supertest cases on a guarded route: SA allowed, PM(a) allowed, PM(other) 404, client 404 or 403 as specified, malformed id 400. |
| APPS-01 | Client drops a server conflict silently; non-network rejections stall the queue with no error shown | `apps/mobile/src/features/field-notes/sqlite-store.ts:108-117` | Branch settle on outcome: on 'conflict', keep the local version (a conflict row) and show it. |
| APPS-02 | Field-notes screen has no error state; a store-initialisation failure leaves the skeleton forever | `apps/mobile/src/features/field-notes/use-field-notes.ts:101-109` | Catch initialisation and read failures into an `error` field and render the shared ErrorState with a retry; |
| APPS-03 | Idempotency key (recordId, baseVersion) collides for distinct writes; a concurrent or second edit is lost as a 'duplicate' | `packages/core/src/offline/queue.ts:24-26, 33-45` | Add a per-write client mutation id (UUID v7) to QueuedMutation and make it part of the key, or bump a local version for each queued edit. |
| APPS-05 | app.json lacks ios.supportsTablet: native builds run on iPad in iPhone compatibility mode | `apps/mobile/app.json:10-12` | Add `"supportsTablet": true` under expo.ios, and check again on the iPad simulator with a development build. |
| APPS-06 | apps/mobile has no test runner: account-screen states and the SQLite queue are untested, and pnpm check skips the workspace | `apps/mobile/package.json:46-54` | Add jest-expo and RNTL to apps/mobile, mirroring packages/ui, with a `test` script. |
| APPS-08 | apps/web README is still the create-next-app scaffold, and the documented dev commands do not give the documented ports | `apps/web/README.md:1-34` | Replace apps/web/README.md with an AMPM one like apps/mobile's. |
| CODE-01 | Import-boundary lint is looser than the documented dependency direction | `packages/config/eslint/boundaries.mjs:18-21` | Give each package its own allow-list. |
| CODE-02 | Hard-coded user-facing strings in shipped app screens and the gallery while i18next sits unused | `apps/mobile/src/features/account/account-screen.tsx:30` | Create the app's i18n instance once at the root layout. |
| CODE-03 | API repository scoping hard-codes the assignment-scoped roles instead of reading packages/policy | `apps/api/src/db/scoping.ts:17` | Use principal.roles.every((role) => STAFF_ROLES[role].assigned), importing STAFF_ROLES from @ampm/policy, and add a unit test that ties the two together. |
| CODE-04 | Domain types defined twice across packages, two of them exported under the same name | `packages/core/src/schemas/identity.ts:6-10` | Have policy derive from core: StaffRole = StaffRoleCode, or add a compile-time equality check, and PrincipalType from core. |
| CODE-05 | Definition of done not met for shared code: usage examples, JSDoc and tests missing | `packages/core/src/logger.ts:68` | Add a short usage example to each exported symbol's JSDoc. |
| CODE-06 | Shared Link casts href to Href, which turns off Expo typed routes for every in-app link | `packages/ui/src/components/link/link.tsx:12` | Use discriminated props, { href: Href; |
| CODE-07 | apps/mobile imports @ampm/core and zod without declaring them | `apps/mobile/src/lib/env.ts:1-2` | Add "@ampm/core": "workspace:*" and "zod": "catalog:" to apps/mobile/package.json, and enable import-x/no-extraneous-dependencies in packages/config/eslint/index.mjs. |
| DATA-01 | Standard columns missing on 8 of the 12 module A tables, with no recorded exception, while D-022 claims 'audit columns' | `apps/api/prisma/schema.prisma:164-165, 172-182, 184-194, 233, 255-256, 270-271, 281-301, …` | Add the missing columns in an additive migration (expand-and-contract), at least deleted_at, created_by and updated_at/updated_by on user_roles, role_permissions, permissions, auth_tokens, notifications, notification_preferences … |
| DATA-02 | No partial indexes on deleted_at IS NULL; unique constraints also cover soft-deleted rows | `apps/api/prisma/migrations/20261026223626_module_a_identity_access_administration/migratio…` | Add a raw SQL migration that creates partial indexes WHERE deleted_at IS NULL for the hot read paths: users (user_type, status), project_members (project_id, status) and (user_id, status), and import_jobs (project_id, status). |
| DATA-03 | The soft-delete Prisma client extension from architecture §8 is not implemented | `apps/api/src/db/prisma.service.ts:9-12` | Implement the extension in PrismaService: query hooks that add deletedAt: null to find*/count/aggregate on models with deleted_at, and that rewrite delete/deleteMany as update/updateMany setting deletedAt and updatedBy. |
| DATA-04 | Principal lookup does not exclude soft-deleted roles, so a deleted role still grants its permissions | `apps/api/src/policy/principal.repository.ts:38-41` | Filter the relation: roles: { where: { role: { deletedAt: null } }, include: { role: true } }. |
| DATA-07 | Polymorphic entity_type columns have no check constraint on the allowed types | `apps/api/prisma/schema.prisma:249, 286` | Add a raw SQL migration with CHECK (entity_type IN (…)) on both tables for the module A entities, and extend it in each later module's migration. |
| DATA-08 | The generated field matrix was not rebuilt after the identity_subject change; §19 and the permission matrix still name the removed columns | `docs/field-matrix.md:60, 62` | Run python3 docs/tools/field_matrix_build.py and commit both outputs. |
| DATA-10 | audit_events actor FK is ON DELETE SET NULL, so the database can rewrite append-only rows and erase the actor | `apps/api/prisma/schema.prisma:295` | Declare onDelete: Restrict, or NoAction, on AuditEvent.actor. |
| DATA-11 | AuditService masking misses camelCase secret keys, so a Prisma record would store tokenHash and identitySubject unmasked | `apps/api/src/policy/audit.service.ts:38-39, 47-48` | Normalise keys before matching (strip '_' and compare case-insensitively, or match both snake and camel forms). |
| GAP1-11 | An oversized request body (body-parser 413) leaves as 500 internal; body parsing is untested | `apps/api/src/main.ts:8` | Map errors that carry a numeric `status`/`statusCode` from 400 to 499 (http-errors) to their status in toAppError, adding 413 to STATUS_CODES or mapping it to validation_failed with the 413 status. |
| GAP2-01 | Text caps OS font scaling at 1.3x for titles and 2x for all other text, below the OS setting and, for titles, below WCAG's 200% | `packages/ui/src/components/text/text.tsx:49` | Raise the cap to at least 2 for display and title, and remove it or raise it to about 3.1 for body variants. |
| GAP3-07 | CI performs no dependency scanning | `.github/workflows/ci.yml:42-48` | Add a dependency-scanning step to ci.yml (for example `pnpm audit --audit-level=high`, or actions/dependency-review-action on pull requests), plus .github/dependabot.yml for npm and github-actions. |
| GAP4-01 | Soft-deleted roles still grant their permissions: the only repository omits the role soft-delete filter | `apps/api/src/policy/principal.repository.ts:39` | Filter the relation: `roles: { where: { role: { deletedAt: null } }, include: { role: true } }`. |
| GAP4-02 | x-request-id accepted up to 128 characters but audit_events.request_id is VARCHAR(64) and undocumented | `apps/api/src/common/request-context.middleware.ts:8` | Use one limit: either tighten the regex to {8,64} or widen the column to VarChar(128) with an expand migration. |
| GAP4-04 | The soft-delete Prisma client extension of architecture §8 does not exist and no record defers it | `apps/api/src/db/prisma.service.ts:9-12` | Implement the §8 extension on PrismaService ($extends with query hooks that add deletedAt: null to reads of models with the column and rewrite delete/deleteMany to an update of deletedAt). |
| GAP5-09 | The D-records were never mirrored into docs/adr/, and no record withdraws the commitment | `docs/engineering/standards.md:38` | Either add a generator (vault_build.py or new_decision.py) that writes docs/adr/D-nnn.md for every build decision, run it for D-017 to D-026 and add it to the docs/README.md list of generated files; |
| GAP5-10 | The knowledge graph is stale at HEAD: d176d1a was never mapped | `graphify-out/graph.json (last changed in 4ae7966` | Run 'graphify update .' and commit graphify-out/. |
| GAP5-11 | Bug fix e5a4553 landed without a failing test | `packages/ui/src/components/skeleton/skeleton.tsx:10` | Add skeleton.test.tsx and toast.test.tsx cases that mock Platform.OS = 'web', spy on Animated.timing and assert useNativeDriver is false (and true on ios). |
| PLAN-02 | CI has never run on a pull request; merges reached main without a green PR check | `.github/workflows/ci.yml:5-8, GitHub PR #1 (app-ampm/ampm-platform), merge commits …` | Take the next change through a conflict-free PR and keep it open until CI is green. |
| PLAN-03 | PR #1 touched sync and permissions without the required code-review and security-review | `GitHub PR #1` | Run code-review and security-review on packages/core/src/offline and the API idempotency path before the real store is built. |
| PLAN-04 | No sprint demo note and no measured pace recorded in the vault | `/Users/amardeepsingh/Desktop/AMPM/vault/notes (Log, Sessions)` | Write a sprint 1 and 2 demo note in the vault: what was demonstrated, hours spent against the part 4.1 rates for each bootstrap step, and the variance. |
| PLAN-06 | The documented API dev command does not load apps/api/.env, so a new machine fails env validation | `README.md:59` | Change the script to "dev": "nest start --watch --env-file .env" (Nest CLI 12 skips a missing file), or load the file in development before loadEnv(). |
| PLAN-07 | Dev ports 3417 and 8082 are documented but set only in a gitignored file, and the API's CORS allowlist depends on them | `README.md:11` | Put the ports in the scripts: "dev": "next dev --port 3417" and "dev": "expo start --port 8082". |
| PLAN-09 | The import boundaries enforce only part of the documented dependency direction | `packages/config/eslint/boundaries.mjs:18-26` | Add a block per package in boundaries.mjs that restricts @ampm/* imports to the allowed set (ui: tokens, core; |
| PLAN-10 | The Claude hooks resolve Node 20, not the repository's Node 24 | `.claude/hooks/check-file.sh:10` | Resolve the version from .nvmrc in the same shell, for example PATH="$(dirname "$(cd "$ROOT" && nvm which "$(cat .nvmrc)")"):$PATH", and check that `node --version` in the hook reports v24. |
| POL-01 | Cell notes and conditions are parsed but never enforced, so restricted keys are over-granted (identity documents, internal cost, audit log) | `packages/policy/scripts/generate.ts:87` | Give each note a structured meaning. |
| POL-04 | Transition parser and canTransition() block transitions the document allows | `packages/policy/scripts/generate.ts:143-147` | Model 'previous status' as a special rule (restore the saved status). |
| POL-05 | decide() ranks own below assigned and keeps only the widest scope, which breaks the union of permissions across roles | `packages/policy/src/engine.ts:84-85,92-94,140-143` | Collect every scope a principal holds for the base key and allow if any one of them is satisfied: all, or assigned with membership, or own with ownership. |
| POL-06 | The §5.16 reports and exports table is skipped silently, so no report or export keys exist | `packages/policy/scripts/generate.ts:103` | Parse §5.16 into reports.<report>.read (May run) and reports.<report>.export (May export) with their (a) scopes, plus a structured exclusion list per report consumed by exportableClasses(). |
| POL-07 | staffReadableClasses() fails open: the Hotel team and Vendor Coordinator get RESTRICTED-FINANCE and RESTRICTED-CONTACT when no side is given | `packages/policy/src/visibility.ts:65-68,87` | Grant only when context.side === "hotel" (HT) or "vendor" (VC), and default to none. |
| POL-08 | Every staff role reads RESTRICTED-NOTES on any record it can see, ignoring the §5 internal-notes rows | `packages/policy/src/visibility.ts:38-44,89` | Derive RESTRICTED-NOTES per resource from the matching §5 internal-notes row (that row's read key), not as a base class. |
| POL-09 | principalReadableClasses() gives a client principal SENSITIVE-GUEST, contrary to §6 | `packages/policy/src/visibility.ts:103` | Remove the client branch, so only a guest's own row adds SENSITIVE-GUEST. |
| POL-10 | An active wedding member with a lapsed discovery subscription becomes read-only | `packages/policy/src/entitlements.ts:80-81` | Make read-only per module (e.g. |
| POL-11 | Demo entitlements omit client finance and mark the whole demo read-only, although §3 lets the demo create | `packages/policy/src/entitlements.ts:19-27,70-72` | Add client_finance to the demo set and replace the global readOnly with per-module read-only (saved_hotels and hotel_assistance writable, the rest read-only). |
| POL-13 | The §6 parser applies one note to every grant in a cell, turns 'own' into no access, and drops 'comment' | `packages/policy/scripts/generate.ts:60-87` | Split cells into comma or semicolon segments and bind each note to its own grant. |
| POL-16 | PermissionGuard is untested and cannot evaluate own scope | `apps/api/src/policy/permission.guard.ts:29-36` | Unit-test the guard (all, assigned member and non-member, own, denyAsNotFound, client principal), plus one e2e test per outcome on a guarded route. |
| TOOL-02 | The boundaries lint enforces only part of the dependency direction, and none of api.md's purity rule | `packages/config/eslint/boundaries.mjs:18-26, 30-47` | Give every package its own no-restricted-imports block listing the @ampm packages it may not import (ui: policy, api-client; |
| TOOL-05 | The Claude hooks run on whatever Node is first on PATH (Homebrew Node 20), not the .nvmrc Node 24 | `.claude/hooks/check-file.sh:10` | Resolve the version from .nvmrc and put that node first: `PATH="$(dirname "$(cd "$ROOT" && nvm which "$(cat .nvmrc)")"):$PATH"`, or source nvm and run `nvm use` in the hook's own shell, not a subshell. |
| TOOL-06 | The generated authorisation suite exercises only the §5 staff rows; §6 client/demo rows and §7 transitions are not iterated | `packages/policy/src/generated/authz.test.ts:29-75` | Extend the suite to iterate MATRIX.others for the CR and DP columns, asserting clientReach() returns exactly the cell's grants, and MATRIX.transitions for every role, system and actor, asserting canTransition() allows exactly the … |
| TOOL-07 | Shared and pipeline code without tests: ThemeProvider, UI hooks, useMe/ApiProvider, AuditService, projectScope, the policy generator | `packages/ui/src/theme/theme-provider.tsx:36,74` | Add RNTL tests for ThemeProvider/useTheme (initial preference, toggling, system scheme) and the three hooks; |
| TOOL-08 | apps/mobile has no test runner and no test script; the non-spike account screen's states are untested | `apps/mobile/package.json (scripts: start, android, ios, web, lint, dev, typecheck; no …` | Add jest-expo with RNTL to apps/mobile (reuse packages/ui's jest config) with a test script, and test AccountScreen's loading, error, offline and success states with a stubbed api-client. |
| TOOL-09 | CI has no dependency or secret scanning and gates no merge; there is no branch protection, and runs on main are cancelled by newer pushes | `.github/workflows/ci.yml:5-12, 35-48` | Add a dependency scan step (pnpm audit --prod --audit-level high or osv-scanner) and Dependabot. |
| UI-02 | Button, pressable Card and Link are focusable but accept no ref | `packages/ui/src/components/button/button.tsx:17` | Add `readonly ref?: Ref<ComponentRef<typeof Pressable>> / undefined` to ButtonProps and CardProps (and to LinkProps, passing it to the Pressable), and forward it to the root Pressable, the same way Input does. |
| UI-05 | A template ESLint exemption that D-021 says is gone still turns off the hex-colour rule | `packages/config/eslint/index.mjs:113-121` | Delete the block at index.mjs:113-121. |

## Confirmed low findings (91)

| ID | Finding | Where |
|---|---|---|
| API-06 | Log redaction matches only snake_case keys; camelCase secrets, identifiers and names pass, and audit images reuse it | `packages/core/src/logger.ts:31-32` |
| API-07 | Unexpected error messages are logged verbatim; the filter's own test passes a password-bearing message to the log | `apps/api/src/common/app-error.filter.ts:31-33` |
| API-08 | Client-supplied x-request-id is trusted from any caller and allowed 128 characters, but audit_events.request_id is VarChar(64) | `apps/api/src/common/request-context.middleware.ts:8,10,14-15` |
| API-14 | Authorization header parsed ad hoc and not schema-validated | `apps/api/src/policy/auth.guard.ts:30-32` |
| API-15 | /health answers 503 with a success envelope | `apps/api/src/modules/health/health.controller.ts:17-19` |
| API-16 | api-client maps non-envelope failures to validation_failed, trusts any server code, and lets response-schema mismatches escape as ZodError | `packages/api-client/src/client.ts:52-63` |
| API-17 | Seed phone numbers are labelled a 'reserved phone range' without any documented basis | `apps/api/prisma/seed.ts:4,99,105,125` |
| API-20 | dev-token script and seed read process.env directly and use console.log | `apps/api/scripts/dev-token.ts:8,12` |
| APPS-04 | Development access token is inlined into every bundle; only its use is guarded | `apps/mobile/src/lib/env.ts:4, 8, 13` |
| APPS-09 | The queue helpers D-026 says to keep depend on the field-note contract it says to remove | `packages/core/src/offline/queue.ts:8, 11-21, 48-56` |
| APPS-10 | uuidv7 uses Math.random ('SPIKE-GRADE') but is on the keep list and not marked SPIKE STAND-IN | `packages/core/src/offline/ids.ts:5-9` |
| APPS-11 | The idempotency key is defined twice; the API does not use the shared definition | `apps/api/src/modules/spike/field-note.service.ts:42` |
| APPS-12 | The encryption-at-rest deferral describes an expo-sqlite API that does not exist | `apps/mobile/src/features/field-notes/sqlite-store.ts:32-34` |
| APPS-13 | SPIKE STAND-IN marker missing on the route, the gallery link, the AppModule wiring and the schema re-exports; SpikeModule is mounted in every environment | `apps/mobile/src/app/field-notes.tsx:3` |
| APPS-14 | Account screen hardcodes its text and shows raw enum values as labels | `apps/mobile/src/features/account/account-screen.tsx:30, 57, 59, 61, 63-66, 77, 92-93` |
| APPS-15 | Feature folders are flat and screen files hold several components | `apps/mobile/src/features/account/account-screen.tsx:21, 42, 52, 85` |
| APPS-17 | app.json hard-codes hex colours copied from the tokens | `apps/mobile/app.json:15, 31, 35` |
| APPS-18 | apps/mobile imports @ampm/core and zod without declaring them | `apps/mobile/package.json:5-40` |
| CODE-08 | Casts that force a type onto untyped or loosely typed data | `packages/api-client/src/client.ts:52` |
| CODE-09 | Several components per file in shipped ui and app files | `packages/ui/src/components/button/button.tsx:39` |
| CODE-10 | Feature-folder layout not followed outside the spike | `apps/mobile/src/features/account/account-screen.tsx:1` |
| CODE-11 | Boolean props and fields not named isX/hasX/canX | `packages/policy/src/entitlements.ts:6` |
| CODE-12 | Constants named inconsistently: camelCase lookup tables beside SCREAMING_SNAKE | `packages/ui/src/components/callout/callout.tsx:29` |
| CODE-13 | process.env read outside env.ts in the Prisma config, seed, dev-token script and e2e spec | `apps/api/prisma.config.ts:15` |
| CODE-14 | The logger's console sink escapes no-console through a shadow declaration, not a stated exemption | `packages/core/src/logger.ts:48-60` |
| CODE-15 | Expo template lint exemption still active after the template was removed | `packages/config/eslint/index.mjs:113-120` |
| CODE-16 | Hard-coded spacing numbers in shipped ui components | `packages/ui/src/components/sheet/sheet.tsx:120` |
| CODE-17 | Raw Error thrown in API code instead of typed core errors | `apps/api/src/modules/admin/me.service.ts:11` |
| CODE-18 | Apps do not use the strict shared tsconfig base; the API turns off strictPropertyInitialization | `apps/api/tsconfig.json:20` |
| CODE-23 | apps/mobile has no test runner or tests for its shipped screen | `apps/mobile/package.json:42-50` |
| DATA-09 | audit_events.request_id added to the schema without updating the data model or the field matrix | `apps/api/prisma/schema.prisma:292` |
| DATA-12 | Foreign key import_jobs.created_by → users has no index | `apps/api/prisma/schema.prisma:335-337` |
| DATA-13 | Field-matrix constraints not carried into the schema (nullability, range, length, lowercase) | `apps/api/prisma/schema.prisma:113, 267, 324, 326` |
| DATA-15 | Assigned-role list hard-coded in scoping.ts instead of read from packages/policy | `apps/api/src/db/scoping.ts:17` |
| GAP1-05 | Both adapters accept a token with no exp claim, against the interface contract; no test | `apps/api/src/identity/local.adapter.ts:21-24` |
| GAP1-12 | Every ZodError, including the API's own response-schema parses, becomes 400 validation_failed with field paths | `apps/api/src/common/app-error.filter.ts:43-49` |
| GAP2-02 | Button and StatusChip labels (and the gallery's fixed-width story tiles) are one line, so large text truncates them instead of wrapping | `packages/ui/src/components/button/button.tsx:45` |
| GAP3-02 | No host is specified for the client portals' browser build; the production compose list has no runtime for Expo server output | `apps/mobile/app.json:23` |
| GAP4-03 | AuditService writes audit_events through PrismaService directly, bypassing the repository layer | `apps/api/src/policy/audit.service.ts:5` |
| GAP4-05 | PolicyModule exports its repository, not only its service interface | `apps/api/src/policy/policy.module.ts:21` |
| GAP4-11 | The configurations table lacks the standard deleted_at column | `apps/api/prisma/schema.prisma:303-317` |
| GAP4-13 | modules/health sits in the module folder but is not a data-model module | `apps/api/src/modules/health/health.module.ts:6` |
| GAP5-02 | data.md's repositories glob matches no file, and the existing repository sits outside it | `.claude/rules/data.md:2-5` |
| GAP5-03 | styling.md misses the web globals.css and the hex values in app.json | `.claude/rules/styling.md:7` |
| GAP5-05 | api.md does not load for app code its own rule governs | `.claude/rules/api.md:2-6` |
| GAP5-08 | D-records were created after the code they record | `vault/notes/Build decisions/D-022 …md, D-025 …md:29, D-026 …md; commits 1bf21d2, bc20c21, …` |
| GAP5-12 | d176d1a pairs a validation fix with a refactor of the spike's screen and hook | `commit d176d1a: apps/api/src/common/zod.ts, zod.spec.ts, field-note.controller.ts` |
| GAP5-13 | 04bb8cf 'monorepo skeleton' also carries a day of design-package and rule-file work | `commit 04bb8cf (parent 91b789b, 26 Oct 13:00)` |
| GAP5-14 | The 27 October completion summaries for 9503966 and d176d1a do not list what was reused | `vault/notes/Sessions/2026-10-26 Session 6d9c1b45.md:69,72` |
| PLAN-05 | The VPS stack as code has not started, although the plan says to build it against a local VM until the server exists | `repository root (no infra/)` |
| PLAN-08 | apps/web/README.md is still the create-next-app scaffold, contradicting the handover and R13 | `apps/web/README.md:1` |
| PLAN-11 | i18next exists in packages/core but no app uses it; the account screen hardcodes its strings | `apps/mobile/src/features/account/account-screen.tsx:30` |
| PLAN-12 | No branch protection and no GitHub organisation; fixes went straight to main despite 'merges go through pull requests by habit' | `GitHub app-ampm/ampm-platform settings; commits bc20c21, 9503966, d176d1a on main` |
| PLAN-13 | The README clones over SSH, which D-004 rejected | `README.md:32` |
| PLAN-15 | The dev-token usage comment mints a token for the subject '--' | `apps/api/scripts/dev-token.ts:2` |
| PLAN-16 | CLAUDE.md and README status lines are stale or inaccurate | `CLAUDE.md:11` |
| PLAN-17 | Rule files and the standards were not updated after the decisions that changed them | `.claude/rules/api.md:10` |
| PLAN-18 | Several decision-record claims overstate what is in the repository | `packages/config/package.json` |
| PLAN-20 | D-023's open-item list leaves out real open items | `/Users/amardeepsingh/Desktop/AMPM/vault/notes/Build decisions/D-023 Handover the AMPM …` |
| PLAN-23 | Branch names do not follow the documented convention | `.claude/rules/code.md:62` |
| PLAN-24 | Small version statements disagree with the repository | `docs/engineering/offline-spike.md:49` |
| POL-12 | Smaller entitlement deviations: agreement grants hotel discovery, archived keeps support, closed keeps live chat, project hotels missing | `packages/policy/src/entitlements.ts:40-45,46-53,74-75` |
| POL-14 | §10 class-specific actions cannot be represented; parsePermissionKey rejects them | `packages/policy/src/roles.ts:27-36` |
| POL-18 | Repository scoping hard-codes the assigned roles instead of reading the policy package | `apps/api/src/db/scoping.ts:17` |
| TOOL-03 | The three apps do not extend the strict base tsconfig; apps/api turns off strictPropertyInitialization | `apps/api/tsconfig.json:1-23` |
| TOOL-10 | The Expo-template ESLint exemption is still active although D-021 records it as removed | `packages/config/eslint/index.mjs:113-121` |
| TOOL-12 | LEFTHOOK=0 lets non-conventional checkpoint commits and build cache land on main; the checkpoint never commits in worktrees, which the docs do not say | `docs/tools/checkpoint.sh:13, 22-38` |
| TOOL-13 | Branches are named claude/<name>, not feat/fix/chore/<name> | `git branch -a (local and origin)` |
| TOOL-14 | The seed lacks most test principals of test-cases §7; test-cases §1 names client roles that permission-matrix §2 replaced; e2e runs do not start from a clean load | `apps/api/prisma/seed.ts:15-21` |
| TOOL-15 | UI component tests cover ui.md's interaction states only partly | `packages/ui/src/components/button/button.test.tsx:42-50` |
| TOOL-16 | Lint exemptions recorded nowhere, and process.env read outside env.ts with no rule enforcing it | `packages/config/eslint/index.mjs:127-131, 138-142` |
| TOOL-17 | `as` assertions in test files | `apps/api/src/common/app-error.filter.spec.ts:12-13` |
| TOOL-21 | CI actions and the service image are pinned by floating tag only | `.github/workflows/ci.yml:20, 36-38` |
| UI-06 | Icon, Spacer, Link, StatusChip and Sheet do not forward ...rest; Spacer and Sheet take no className | `packages/ui/src/components/icon/icon.tsx:42` |
| UI-07 | Seven components define variants in local record maps instead of variants() in <name>.styles.ts | `packages/ui/src/components/link/link.tsx:48-56` |
| UI-08 | EmptyState, ErrorState and OfflineState folders have no tests or stories; Toast has no toast.tsx | `packages/ui/src/components/empty-state/` |
| UI-09 | Card's visual variant is a boolean (`elevated`) | `packages/ui/src/components/card/card.tsx:8` |
| UI-10 | Link has no hover or pressed state | `packages/ui/src/components/link/link.tsx:48-56` |
| UI-11 | Image has no error state | `packages/ui/src/components/image/image.tsx:63-66` |
| UI-12 | Image's fade-in ignores reduced motion | `packages/ui/src/components/image/image.tsx:59` |
| UI-13 | Skeleton, Toast and Sheet animate with RN Animated or the Modal's built-in slide, with platform easing instead of Reanimated, CSS transitions and the token easings | `packages/ui/src/components/skeleton/skeleton.tsx:30-43` |
| UI-14 | Pixel literals in component code: icon sizes and safe-area offsets | `packages/ui/src/components/icon/icon.tsx:23` |
| UI-15 | A 2px spacing step off the 4px scale is defined and used | `packages/tokens/src/spacing.ts:9` |
| UI-16 | maxWidth, letterSpacing, opacity, borderWidth and ringWidth come from Tailwind's defaults, not from the tokens | `packages/tokens/scripts/generate.ts:102-115` |
| UI-17 | cn() does not know the token class names, so overrides of custom steps are not resolved | `packages/ui/src/lib/cn.ts:9-11` |
| UI-18 | The weight prop replaces the display face: MoneyText at title or display size renders in Source Sans | `packages/ui/src/components/text/text.styles.ts:10-11,31-35` |
| UI-19 | User-facing strings outside copy.ts and not taken as props (Input's required marker, Gallery labels) | `packages/ui/src/components/input/input.tsx:37` |
| UI-20 | Several stories modules do not document every variant and state | `packages/ui/src/components/text/text.stories.tsx:24-37` |
| UI-22 | The Sheet scrim is focusable on the web with no visible focus state | `packages/ui/src/components/sheet/sheet.tsx:62-69` |
| UI-24 | ThemeProvider has no tests or stories | `packages/ui/src/theme/theme-provider.tsx:36-72` |
| UI-25 | Hex colours for the splash and adaptive-icon backgrounds in app.json | `apps/mobile/app.json:15,31,35` |

Not listed: 84 items the reviewers marked as information or as covered by a recorded deferral (D-020, D-021, D-023, D-026), and 1 finding the verifiers refuted (UI-04, the Link without next/link: expo-router's Link already serves the web export).
