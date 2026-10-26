# AMPM Engineering Standards — the AMPM edition of the universal-app standards

**Version:** 1.0 · 26 October 2026 · **Source:** "Engineering Standards & Claude Code Setup — Universal App (Web, iOS, Android)", version 1.0 of 26 October 2026, reviewed against AMPM's locked decisions, the architecture draft (T-1 to T-14, §4 technology choices) and the delivery model (one developer with Claude Code, decision D-012).

This document is the engineering layer under the platform blueprint. The blueprint says what is built; this says how. Part 1 is the review of the source standards: what is adopted as written, what is changed for AMPM and why, what is added because the source does not cover it. Part 2 is the standards themselves as they apply here. The enforceable parts are installed in the repository: path-scoped rules in `.claude/rules/`, hooks in `.claude/hooks/`, the import boundaries in `packages/config/eslint/boundaries.mjs`, and a pointer in the root `CLAUDE.md`. They are inert until code exists under `apps/` and `packages/`.

---

## Part 1 · Review of the source standards

### 1.1 Verdict

The source document is a sound, current industry baseline for a universal TypeScript product: one monorepo, one shared UI built on React Native primitives and rendered on web and native, tokens as the single source of theme, contract-first schemas shared by API and clients, strict typing and lint boundaries enforced by hooks and CI, and a reuse-first discipline. Its strongest idea for a developer working with Claude Code is the third layer, enforcement: rules that a hook or a linter checks rather than prose that a model may forget. All of that is adopted.

Four of its stack choices are changed, because AMPM's documents and the drafts already decided otherwise for reasons that hold: the API framework, the ORM, the data and auth platform, and where the browser version of the client portals is built. Six areas are added that the source does not cover and AMPM requires: security and field visibility, offline operation, data conventions, background jobs and integrations, release and operations, and the enterprise controls a platform holding guest identity documents needs.

### 1.2 Decision by decision

| Area | Source standard | AMPM decision | Why |
|---|---|---|---|
| Monorepo | pnpm workspaces + Turborepo; `apps/` and `packages/`; lint-enforced dependency direction | **Adopted** | One developer, two apps, one API and a public site share types, schemas, UI and tokens; the boundaries keep the modular monolith modular (architecture §5) |
| Mobile | Expo + Expo Router, one codebase for iOS and Android, EAS builds | **Adopted**, with tablet layouts for both apps (decided 26 October) | Matches T-1; `useBreakpoint()` layouts cover phone and tablet |
| Shared UI and styling | React Native primitives + react-native-web + NativeWind; tokens generate one Tailwind preset; semantic colours; one Tailwind major | **Adopted** | The browser version of the client portals (R4, decided) is the same code; the Tailwind-major rule prevents the one known trap |
| Web | Next.js App Router for all web, with react-native-web aliased into it | **Changed**: Next.js only for the public website; the browser version of the client portals is the Expo web build of `apps/mobile` | The portals are private and need no SSR or SEO; aliasing react-native-web into Next.js is the fragile part of the source setup; one codebase is then literally one build target |
| API | Hono + Drizzle; routes thin, services hold rules, repositories hold queries | **Changed**: NestJS (architecture §4 row 3) with the same route, service, repository layering; Hono stays the fallback if the developer's stack answers (K4) favour it | Seventeen modules with enforced boundaries, guards and interceptors that implement the eight-step permission pipeline, dependency injection for provider adapters, first-class BullMQ and WebSocket integration, OpenAPI generation. The source itself notes NestJS "slots into the same spot" |
| ORM | Drizzle | **Changed**: Prisma (architecture §4 row 4); Drizzle acceptable | The schema file mirrors data-model.md and can be generated from it; migrations are versioned. Partitioning, row-level security and the search view are raw SQL migrations under either ORM |
| Contracts | Zod schemas in `packages/core`, one schema for validation, client and forms | **Adopted** (`nestjs-zod` on the API; typed client generated from OpenAPI or `ts-rest`) | Field matrix rules become Zod schemas once |
| State | TanStack Query for server state, Zustand for UI state, react-hook-form | **Adopted**, plus the offline store for the team app (part 2.6) | TanStack Query's cache is not an offline database; the wedding-day data needs one |
| Data, auth, storage | Supabase (Postgres, Auth, Storage) | **Changed; R13 locked on 26 October 2026 as G2, everything on AMPM's dedicated VPS (options document part 7)**. The review below predates the lock: PostgreSQL on AWS RDS in Mumbai with copies in Hyderabad, S3 in three buckets with separate keys, as the architecture proposes; Supabase in its Mumbai region is the documented solo-friendly variant | Identity documents need a restricted store with its own key; the brief asks for reliable recovery; the second Indian region exists only on AWS. Supabase gives up the second region and per-bucket keys in exchange for far less operation. The founder decides under R13 with both laid out |
| Authentication | Supabase Auth JWT verified in API middleware | **Changed from the draft and from the source**: a managed identity service for credentials, OTP and MFA (Cognito in Mumbai with a custom SMS sender for the DLT provider if AWS; Supabase Auth with its SMS hook if Supabase); AMPM's principals, guest token sessions, entitlements and the no-self-registration rule stay in the API | The architecture's T-6 proposed self-managed auth for ownership; one developer should not maintain password, OTP and MFA code, and ownership is preserved by keeping the identity service in AMPM's account. Revises T-6 in version 0.3 |
| Business rules only in the API | Clients never touch the database | **Adopted** | Already principle 2 of the architecture and rule 18 of the brief |
| i18n | i18next | **Adopted** | T-8: the guest portal is translation-ready from day one |
| Testing | Vitest, React Native Testing Library, Playwright, Maestro; tests next to code; no snapshot tests | **Adopted**, plus adapter contract tests and the authorisation suite generated from the permission matrix | SPEC §12 tampering scenarios become automated tests (architecture §4 row 20) |
| Quality gates | Strict TypeScript, ESLint flat config with boundaries, Prettier, lefthook, commitlint, GitHub Actions | **Adopted** | |
| Claude Code hooks | PostToolUse lint on every written file; Stop hook that blocks while typecheck fails | **Adopted, merged** with the repository's existing hooks (journal, memory, checkpoint, graph guard) and guarded to do nothing until the monorepo exists | A docs-only turn must not be blocked by a typecheck of code that does not exist |
| Rules files | Path-scoped `.claude/rules/*.md`, under 200 lines each | **Adopted**, with three AMPM files added: security, offline, data | |
| Code standards, accessibility, definition of done, "when unsure, ask" | As written | **Adopted** | |
| ADRs in `docs/adr/` | Record every new pattern or dependency category | **Adopted in form**: the build-decision records D-nnn in the vault are the ADRs; they will be mirrored into `docs/adr/` of the platform repository when code starts | The project already has the tooling (`new_decision.py`) and twelve records |

### 1.3 What the source does not cover and AMPM needs

- **Security and visibility.** Ten visibility classes, serialisers per class so restricted fields are never sent, denial answered as absence, 15-minute signed file links, a separate restricted store for identity documents, audit events, webhook signatures and idempotency, rate limits, no personal data in logs. Installed as `.claude/rules/security.md`.
- **Offline operation.** The team app must work without signal on the wedding day: a local store scoped to the role, a change queue replayed with original timestamps, server-wins on status transitions, a conflict log, encrypted local data wiped on sign-out, visible offline and pending state. Installed as `.claude/rules/offline.md`.
- **Data conventions.** The data model's §1: UUID v7 ids, created, updated and deleted stamps, money as exact decimals with a currency, client and internal amounts always separate, statuses in code and labels in configuration, immutable shared versions, soft delete, monthly audit partitions, retention by proposal. Installed as `.claude/rules/data.md`.
- **Jobs and integrations.** Every provider behind one adapter with a sandbox configuration and a contract test; every job idempotent with a recorded outcome; every webhook signature-checked and processed once. Folded into `.claude/rules/api.md`.
- **Release and operations.** EAS build profiles; a store-review allowance in every plan; feature switches as configuration rows; no deployment while a wedding is live; expand-and-contract migrations; staging never holds real guest data; structured logs with a request id and Sentry for errors, business audit separate from logs.
- **Enterprise controls.** Branch protection with required checks; dependency, container and secret scanning in CI; pinned versions and signed images; a penetration test before launch and annually; quarterly restore drills; service-level objectives from T-12 with alarms; runbooks per job and integration; data classification by visibility class; a breach runbook.

### 1.4 Scalability and optimisation, in this stack

The modular monolith (one API, one worker) is the right size for 200 hotels and 20 concurrent weddings and scales tenfold by adding containers and a read replica; its module boundaries are the seams for a later split. Specific choices that keep it fast and cheap: stateless containers behind a load balancer; Redis for sessions, rate limits and short caches; BullMQ for everything that need not block a request; monthly partitions on audit and notification tables; a maintained search view with trigram indexes instead of a search cluster; media served through a content network with signed links and sized once at upload; materialised views for dashboards; cursor pagination on every list; a performance budget on the apps (list virtualisation, image sizes from tokens, Hermes, no synchronous storage on the render path) and on the web (static public site, route-level code splitting). T-12 sets the targets: 99.5 percent monthly availability, most requests under 0.4 seconds, pages usable within 3 seconds on 4G.

---

## Part 2 · The standards as they apply to AMPM

### 2.1 Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm 12 workspaces (hoisted linker, version catalog for React and TypeScript) + Turborepo 2; package scope `@ampm` for packages, plain `web`, `mobile`, `api` for the apps; Node 24 LTS through nvm (`.nvmrc`), since Expo SDK 58 requires Node 22.13 or newer |
| Public website | `apps/web`: Next.js App Router, static pages, Tailwind with the shared preset |
| Apps | `apps/mobile`: Expo + Expo Router; iOS, Android, iPad and Android tablets; the client portals' browser version is this app's web export |
| Shared UI | `packages/ui`: React Native primitives + react-native-web + NativeWind; `packages/tokens` the only place theme values exist |
| API | `apps/api`: NestJS modular monolith, REST and WebSocket, OpenAPI; the worker is a second entry point of the same application |
| Data | PostgreSQL 16 with Prisma; schema mirrors `docs/data-model.md`; raw SQL migrations for partitions, row-level security and the search view |
| Contracts | Zod schemas in `packages/core`; API validation through them; typed client and TanStack Query hooks in `packages/api-client` |
| Policy | `packages/policy`: the permission matrix as code (keys, scopes, visibility classes) and the generator for the authorisation test suite |
| State | TanStack Query (server), Zustand (UI, one store per feature), react-hook-form + Zod (forms); offline store in the team app (see 2.6) |
| i18n | i18next; `en` namespace first; guest portal translation-ready |
| Testing | Vitest; React Native Testing Library; Playwright (web); Maestro (mobile); adapter contract tests against sandboxes; generated authorisation suite |
| Quality gates | TypeScript strict; ESLint flat config with boundaries; Prettier with Tailwind class sorting; lefthook; commitlint; GitHub Actions; Claude Code hooks |
| Hosting | R13 locked 26 October 2026: everything on AMPM's dedicated VPS (option G2): Docker Compose as code, PostgreSQL 16 with pgBackRest archives to an S3 bucket in Mumbai and rehearsed restores, Redis, files in Mumbai buckets (identity documents under their own key), Caddy for TLS; Cognito for identity (locked 26 October 2026); the specification is `docs/engineering/vps-setup.md` |

### 2.2 Repository layout and dependency direction

```
apps/
  web/            Next.js: the public website only
  mobile/         Expo + Expo Router: client app and team app (iOS, Android, tablets, web export of the client portals)
  api/            NestJS: API and worker entry points, Prisma schema and migrations
packages/
  tokens/         design tokens: colours, spacing, radii, type scale, motion
  ui/             universal components and UI-only hooks, built on tokens
  core/           pure TypeScript: domain types, Zod schemas, business rules, constants, errors, logger, i18n keys
  policy/         permission keys, scopes, visibility classes; authorisation test generator
  api-client/     typed API client + TanStack Query hooks
  config/         shared eslint, tsconfig, prettier, tailwind presets
docs/             the design package (blueprint, drafts, decisions) and docs/engineering
.claude/          settings.json (hooks), rules/, hooks/
CLAUDE.md
```

Dependency direction, lint-enforced: `apps → packages` · `ui → tokens, core` · `api-client → core, policy` · `policy → core` · packages never import apps · `core`, `tokens` and `policy` are framework-free. Inside each app, code is organised by feature: `apps/<app>/src/features/<feature>/{screens|pages,components,hooks}`. In the API, modules mirror the data model's modules A to Q (architecture §5), and a module reaches another only through its service interface or a domain event.

### 2.3 How the standards are enforced

1. **Instruction files.** The root `CLAUDE.md` carries the project rules every session needs and points here. The files in `.claude/rules/` load only when Claude edits matching paths: `code.md` (apps and packages), `ui.md`, `styling.md`, `api.md`, `security.md`, `offline.md`, `data.md`, `infra.md` (the VPS stack, Compose files, workflows). Each stays under 200 lines; rules, not essays.
2. **Enforcement tooling.** Strict TypeScript; ESLint with the boundaries in `packages/config/eslint/boundaries.mjs` and a rule against arbitrary Tailwind values; Prettier; lefthook running lint-staged and commitlint; GitHub Actions failing on lint, type or test errors. Claude Code hooks: `.claude/hooks/check-file.sh` formats and lints every TypeScript file Claude writes and returns errors as feedback (exit 2); `.claude/hooks/typecheck.sh` refuses to end a turn while `turbo run typecheck` fails. Both exit quietly while the repository has no `pnpm-workspace.yaml`, so the design-package sessions are unaffected. They run alongside the existing hooks: session journal, memory, checkpoint commit and the graph guard.
3. **Repository structure.** Shared code has one home in `packages/`; tokens are the only place theme values exist; the policy package is the only place permission keys exist. Reuse is the path of least resistance.

### 2.4 Rules in brief

The full text is in `.claude/rules/`. In brief:
- **Reuse first.** Search `packages/` by concept before creating anything; anything used twice lives in `packages/`; variants are props, not new components; new shared code is exported, documented with a usage example and tested.
- **Architecture.** `packages/ui` is presentational; server state in TanStack Query, UI state in Zustand, forms in react-hook-form with the shared Zod schema; contract-first API; navigation stays in the app; typed errors mapped to one envelope; env read once per app through a Zod-validated `env.ts`.
- **Code.** Strict TypeScript, no `any`, no `as` to silence, no `@ts-ignore`; named exports; one component per file; kebab-case files, PascalCase components and types; functions at most 40 lines, files at most 300; no hardcoded colours, spacing, sizes or user-facing strings; no `console.*`; comments say why; ask before adding a dependency; React and React Native versions follow the Expo SDK.
- **Accessibility.** Label, 44-point targets and focus state on everything interactive; loading, empty, error and offline states on every screen; contrast 4.5:1; meaning never by colour alone; reduced motion and font scaling respected.
- **Security.** Permission check in the service, every time; response model per visibility class; restricted and sensitive fields never serialised to a client; denial answered as 404; files only through 15-minute signed links; identity documents in the restricted store, every read audited; webhooks verified and idempotent; rate limits; no personal data or secrets in logs.
- **Offline.** Role-scoped local store; change queue with original timestamps; server-wins on status transitions, conflict log for the rest; encrypted at rest, wiped on sign-out; offline and pending state always visible; nothing lost silently.
- **Data.** UUID v7; created, updated, deleted stamps on every table; `numeric(14,2)` plus currency; client and internal amounts in separate columns; statuses in code, labels in configuration; shared versions immutable; soft delete; expand-and-contract migrations; every foreign key indexed.
- **Git.** Branches `feat|fix|chore/<name>`; Conventional Commits; small commits; no secrets, `.env*` or generated files committed; no force-push to shared branches.
- **Definition of done.** `pnpm check` green; all states and accessibility covered; shared code exported, documented, tested; no TODO without an issue link; the summary lists what was reused and what was added to `packages/`.
- **When unsure.** Stop and ask with two or three concrete options; never invent a pattern or silently deviate.

### 2.5 The policy package

AMPM's permission matrix is a document today. In code it is `packages/policy`: the permission keys (`module.resource.action` with `:assigned` or `:own`), the roles that hold them, the visibility classes and which fields belong to each, and the status transitions with who may move them. The API's guards and serialisers import it; the test generator reads it and emits the authorisation suite that tries every resource against every principal, including URL, identifier and file-link tampering (SPEC §12). When the matrix changes, the tests change with it, and a build fails if the code drifts from the matrix (architecture §14).

### 2.6 Offline in the team app

The team app keeps a local SQLite store (`expo-sqlite`, or a sync library such as WatermelonDB or PowerSync, to be chosen in phase 1 with a thin proof-of-concept) holding the signed-in user's role-scoped data for their assigned weddings: tasks, department information, readiness checklists, cue sheets, arrival and operational lists. Writes made offline go to a change queue with the device's original timestamp and replay on reconnection; the server wins on status transitions, free-text merges keep both versions in a conflict log the project lead reviews; the store is encrypted at rest and wiped on sign-out; the interface shows offline state and pending changes at all times. This is locked by Q1 and Brief §10; the library choice is the developer's.

### 2.7 Bootstrap plan (the first sprint, with Claude Code)

Run in phases; after each, `pnpm check` is green and the result is summarised before the next.
1. **Skeleton.** pnpm + Turborepo; `apps/web` (Next.js), `apps/mobile` (Expo, created with Expo's CLI, pnpm configured per Expo's monorepo docs), `apps/api` (NestJS + Prisma); the six packages with `package.json`, `tsconfig` extending `packages/config`, `src/index.ts`. Current stable versions from each tool's docs, not memory; React and React Native fixed by the Expo SDK; the web app on the same React. **Done 26 October 2026** (D-017): Expo SDK 58 with Expo Router (React 19.3.0, React Native 0.88, TypeScript 6.0.3 from the SDK), Next 16.4, NestJS 12 (its scaffold brings oxlint and Vitest; the ESLint decision is step 3), Prisma 7.10 (the stable line; the registry's latest tag is a release candidate), Turborepo 2.11, pnpm 12.15 hoisted.
2. **Styling.** Read NativeWind's current docs; one Tailwind major across the repo. `packages/tokens` from AMPM's palette with light and dark values, spacing, radii, type scale, fonts, shadows, motion; `tokens:build` emitting the preset and the CSS variables; both apps configured; `cn()` and the variant helper in `packages/ui`. **Done 26 October 2026** (D-018): Tailwind 3.4 with NativeWind 4.2.7 (its stable release; v5, the Tailwind v4 line, is a release candidate), tailwind-merge 2 for the same reason; `packages/tokens` from the design package's palette with a 4.5:1 contrast gate in the generator, semantic colours as CSS variables on `:root` and `.dark:root`, `inlineRem: 16` so rem means the same on native; the same card verified identical on Next, Expo web and iOS, light and dark.
3. **Quality tooling.** Strict base tsconfig; ESLint flat config with the boundaries and the arbitrary-value rule; Prettier; Vitest per workspace; root scripts and `turbo.json` (`dev`, `build`, `lint`, `typecheck`, `test`, `check`, `tokens:build`, `db:generate`, `db:migrate`, `authz:generate`); lefthook and commitlint; the GitHub Actions workflow; the hooks verified. Deliberately add a `packages/ui → apps/web` import and show the lint failure. **Done 26 October 2026** (D-020): ESLint 10 flat config shared from `packages/config/eslint` (typescript-eslint, import-x, react-hooks, the boundaries, the arbitrary-value and hex-colour rules as `no-restricted-syntax` selectors), Prettier 3.9 with the Tailwind plugin, Vitest 5 per workspace, lefthook 2 and commitlint 21, the CI workflow in `.github/workflows/ci.yml`; `check-file.sh` rejected a rule-breaking file, `typecheck.sh` blocked a type error, and the deliberate import failed both ESLint and lefthook. Expo's template components, constants and hooks keep their default exports and colours until step 4 replaces them; the mobile app's test runner is chosen with the UI foundation.
4. **UI foundation.** ThemeProvider, Text, Button, Input, Card, Sheet, Toast, ErrorState, EmptyState, OfflineState, Skeleton, Icon, Image, Link, StatusChip, Callout, Stack/Row/Spacer, `useBreakpoint`; each with typed props, every state, accessibility, tests and stories; a gallery screen on web and native, phone and tablet. **Done 26 October 2026** (D-021): `packages/ui` holds Text, Icon (Lucide through react-native-svg), Stack/Row/Spacer, Skeleton, Button, Input, Card, Link, Image (expo-image), StatusChip, Callout, MoneyText (client amounts only, `ClientAmount` from `packages/core`), Sheet, Toast, EmptyState/ErrorState/OfflineState, `useBreakpoint`, `useReducedMotion`, `useIsClient`; each with a `*.stories.tsx` module (`defineStories`) that the `Gallery` renders on web and native, one column on a phone, two on a tablet, three on a desktop window; Jest with jest-expo's iOS renderer and React Native Testing Library 14, 53 tests; the fonts load through expo-font under the names the tokens declare. Default copy sits in `packages/ui/src/copy.ts` until i18next arrives (sprint 2). Verified on the iPhone 17 Pro and iPad Pro simulators and on Expo web, light and dark, with a clean hydration; Expo's template is gone.
5. **Domain, policy and API skeleton.** `packages/core` errors, logger, first schemas, i18next; `packages/policy` seeded from `docs/permission-matrix.md`; `apps/api` with request id, structured logging, error envelope, the identity integration, the eight-step pipeline as guards and interceptors, Prisma schema for module A generated from the data model, `/health` and `/me`; `packages/api-client` with the typed client and `useMe()`; both apps calling `/me` with the shared states. **Done 26 October 2026** (D-022): `packages/core` has the error codes and envelope, the structured logger, `parseEnv`, the first schemas (`/health`, `/me`) and i18next's `en` namespace; `packages/policy` is generated from `docs/permission-matrix.md` by `pnpm authz:generate` (105 staff rows, 33 client/guest/demo rows, 59 transitions) with `decide()`, `canTransition()`, entitlement resolution, the visibility classes and a generated authorisation suite that CI checks for drift; `apps/api` has the request id, JSON logging, the envelope filter and interceptor, Cognito and local identity adapters behind one interface, the pipeline as `AuthGuard` and `PermissionGuard` with `AuditService` and repository scoping, Prisma 7 with module A (12 tables, first migration), a synthetic seed, `/health` and `/me` with unit and e2e tests against a disposable PostgreSQL; `packages/api-client` has the typed client and `useMe()`; the Expo app's account screen shows `/me` with the shared states. core and policy ship a bundled ESM build (tsup) so Node, Metro, Next and Jest load the same file.
6. **Handover.** D-record for the stack as built, README setup steps, `docs/CONTRIBUTING.md` pointing to `CLAUDE.md` and this document. **Done 26 October 2026** (D-023): the root README carries the new-machine setup (nvm, corepack, PostgreSQL 16, the env files, generate, deploy, seed, dev token) and the run and check commands; `docs/CONTRIBUTING.md` is §2.8 as a working method with the records and the CI gates; the app READMEs replace the scaffolds; D-023 is the stack as built with every version and the open items.

### 2.8 Every feature, every merge

For each feature: re-read the rules that apply; search `packages/` and report what is reused unchanged, extended with which props, new and why; give the plan (schema changes, files by feature folder, tests) and wait for the go; implement contract-first (Zod schema → NestJS route, service, repository → client hook → UI from `packages/ui`); cover loading, empty, error and offline states and accessibility; finish with `pnpm check` green and a report against the definition of done. Before every merge: review the diff against `CLAUDE.md` and every rule file, list each violation as file and line with the rule it breaks, fix them.

### 2.9 Keeping the standards alive

Add a rule when the same mistake happens twice or a review catches what should have been known; keep `CLAUDE.md` short and move anything partial into a path-scoped rule; prefer a lint rule, a type or a hook to prose; record a D-record before a new pattern or dependency category; audit the instruction files periodically.

### 2.10 Day-one checklist

- `jq` and Claude Code installed; `pnpm` and Node LTS installed
- `.claude/rules/*.md`, `.claude/hooks/*.sh` (executable), `.claude/settings.json` hooks, `packages/config/eslint/boundaries.mjs` present (installed 26 October 2026)
- R13 locked (G2): the VPS facts recorded in `docs/engineering/vps-setup.md`, root access arranged, an AWS account in AMPM's name for the Mumbai buckets and Cognito
- Razorpay merchant account, Meta business verification, SMS DLT registration, Apple and Google developer accounts started by AMPM
- Bootstrap phases 1 to 6 run, each ending with `pnpm check` green (done 26 October 2026, D-017 to D-023)
- First feature built with the feature prompt; first merge reviewed with the pre-merge prompt
