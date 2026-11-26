# Contributing: how a feature is built and merged

One developer builds AMPM with Claude Code. This page is the working method; the rules it refers to are in [`CLAUDE.md`](../CLAUDE.md) (what every session reads), [`.claude/rules/`](../.claude/rules/) (rules by path, loaded when a file under that path is touched) and [`docs/engineering/standards.md`](engineering/standards.md) (the standards with their reasons, §2.8 is the source of this page). Setup is in the root [README](../README.md).

## Before a feature

1. Read the rules that apply: `code.md` always; `ui.md` and `styling.md` for screens and components; `api.md`, `security.md` and `data.md` for the API and the schema; `offline.md` for the team app; `infra.md` for the VPS.
2. Find what the design package says: the flow in `docs/user-flows.md`, the screens in `docs/wireframes.md`, the tables in `docs/data-model.md` and `docs/field-matrix.md`, the rows of `docs/permission-matrix.md`, the acceptance tests in `docs/test-cases.md`. The knowledge graph answers "where is this specified": `graphify query "<question>"`.
3. Search `packages/` by concept before creating anything (`rg -i "sheet|dialog" packages/`). Report what is reused unchanged, what is extended with which props, and what is new and why.
4. Give the plan: schema changes, files by feature folder (`apps/<app>/src/features/<feature>/`), the permission keys, the tests. A new pattern or a new category of dependency gets a D-record first (`python3 docs/tools/new_decision.py "Title" --area <area>`, with `AMPM_VAULT` set to the vault checkout when working from a worktree).

## Building it

Contract first, in this order (api.md):

1. Zod request and response schemas in `packages/core/src/schemas/<domain>.ts`; types through `z.infer`.
2. The permission matrix row: curate its resource name in `packages/policy/src/resources.ts`, run `pnpm authz:generate`, and use the key with `@RequirePermission()`.
3. The Prisma model in `apps/api/prisma/schema.prisma` mirroring `docs/data-model.md` (the document changes in the same task), `pnpm --filter api db:migrate` for the migration, raw SQL migrations for partitions, policies and views.
4. Controller (thin, validates with the schema), service (business rule, `decide()` and `canTransition()` from `@ampm/policy`), repository (Prisma with `projectScope()`, the demo flag, visibility and soft delete). One response model per audience, parsed through its schema so nothing else leaves.
5. The TanStack Query hook in `packages/api-client`.
6. The screen from `packages/ui` components only, with loading, empty, error and offline states and accessibility, phone and tablet.
7. Tests next to the code: Vitest for core, policy and the API services, supertest e2e for the endpoints (403 for a forbidden action, 404 for a record the principal may not see, 400 naming the field, 409 for a refused transition), Jest with Testing Library for component behaviour, Playwright and Maestro for critical flows from the sprints that add them (the website's are below).

Finish with `pnpm check` green and a report against the definition of done in `code.md`: all states and accessibility covered, shared code exported, documented and tested, no TODO without an issue link, what was reused and what was added to `packages/`.

## Before a merge

Review the diff against `CLAUDE.md` and every rule file; list each violation as file and line with the rule it breaks; fix them. Then check the invariants that no linter sees: no internal amount reaches a client view (security.md); every query on a project-owned table goes through a scoped repository; every new permission comes from the matrix; the data model document and the schema agree; migrations expand before they contract.

## Commits, hooks and CI

- Branches `feat|fix|chore/<short-name>`; Conventional Commits with a lowercase subject (`feat(ui): add Sheet`); small, focused commits.
- lefthook runs Prettier and ESLint on staged files and commitlint on the message; the Claude Code hooks format and lint every file written and refuse to end a turn while `pnpm typecheck` fails; the checkpoint commits and pushes at the end of each turn.
- CI (`.github/workflows/ci.yml`) installs, generates, checks formatting, runs `pnpm check` with a PostgreSQL service for the API's e2e tests, fails when `packages/policy/src/generated` drifts from `docs/permission-matrix.md`, and builds the web app and the API.
- Never commit `.env*`, secrets, generated output (`dist/`, `apps/api/src/generated/`, `packages/tokens/dist/`) or real guest data; the seed and fixtures are synthetic.

## The website's end-to-end tests

The hotel form has Playwright tests with axe in `apps/web/e2e/` (D-175, D-189 §8, D-190 §5): the identity step (HF-01 to HF-03, HF-08) in `hotel-form.spec.ts`, the overview and the sections (HF-04, HF-05: autosave kept through a reload, two colleagues' conflict) in `hotel-form-sections.spec.ts`, and the review and the status (HF-06, HF-07: the missing items, a submit with both declarations, a correction, removing your details, a colleague's save during the review refused as 409 sectionsChanged) in `hotel-form-submit.spec.ts`; the pages behind the sign-in are checked with axe at a phone's width and at 1440. They are not part of `pnpm check` or CI until the hotel form's gate; run them by hand after changing the form, its headers or `packages/web-forms`.

1. Once per database: `pnpm --filter api db:deploy` (and `pnpm --filter api db:seed` on a new one) against the local database in `apps/api/.env`, with `IDENTITY_PROVIDER=local`. To keep the runs' test requests out of that database, give the run a scratch one instead: create it, set `DATABASE_URL` to it in the shell (it wins over `apps/api/.env`), then deploy and seed it the same way and run the tests from that shell. The tests drive the machine's Google Chrome; without it, run `pnpm --filter web exec playwright install chromium` and set `PLAYWRIGHT_BROWSER=chromium`.
2. `pnpm --filter web test:e2e`. Playwright starts the API on port 3921 with `apps/api/.env` (the stub bot check and console SMS, so the codes are shown on screen) and builds and serves the site on 3431 against it; a server already listening on either port is reused. `HOTEL_FORM_E2E_API_PORT` and `HOTEL_FORM_E2E_SITE_PORT` choose others.
3. Before the tests, it mints a Super Admin's development token and sets the form's mode to `test_only` with a synthetic help contact; each test creates its own test request and revokes it afterwards; at the end the policy is put back with the mode `off`. Never point it at a shared API.
4. Turnstile is stood in for in the browser, at its own address so the page's CSP still applies. Each page is checked with axe (WCAG 2.1 A and AA, best practice). A failure keeps a trace in `apps/web/test-results/` (`pnpm --filter web exec playwright show-trace <trace.zip>`). Stop the servers Playwright did not start yourself; a run stopped halfway leaves the mode at `test_only`, so finish a run or set the policy back in the configuration screen.

## Records

- Technical and process decisions: D-records in the vault (`vault/notes/Build decisions/`); the stack as built is D-023.
- AMPM's decisions: `docs/decisions.json`, then `python3 docs/tools/apply_decisions.py` and the generators listed in `docs/README.md`.
- Each session's narrative: the session note in `vault/notes/Sessions/`, written at every wrap-up.
- The knowledge graph: `graphify update .` after code changes; `/graphify . --update` in a session when documents change.
