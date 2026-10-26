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
7. Tests next to the code: Vitest for core, policy and the API services, supertest e2e for the endpoints (403 for a forbidden action, 404 for a record the principal may not see, 400 naming the field, 409 for a refused transition), Jest with Testing Library for component behaviour, Playwright and Maestro for critical flows from the sprints that add them.

Finish with `pnpm check` green and a report against the definition of done in `code.md`: all states and accessibility covered, shared code exported, documented and tested, no TODO without an issue link, what was reused and what was added to `packages/`.

## Before a merge

Review the diff against `CLAUDE.md` and every rule file; list each violation as file and line with the rule it breaks; fix them. Then check the invariants that no linter sees: no internal amount reaches a client view (security.md); every query on a project-owned table goes through a scoped repository; every new permission comes from the matrix; the data model document and the schema agree; migrations expand before they contract.

## Commits, hooks and CI

- Branches `feat|fix|chore/<short-name>`; Conventional Commits with a lowercase subject (`feat(ui): add Sheet`); small, focused commits.
- lefthook runs Prettier and ESLint on staged files and commitlint on the message; the Claude Code hooks format and lint every file written and refuse to end a turn while `pnpm typecheck` fails; the checkpoint commits and pushes at the end of each turn.
- CI (`.github/workflows/ci.yml`) installs, generates, checks formatting, runs `pnpm check` with a PostgreSQL service for the API's e2e tests, fails when `packages/policy/src/generated` drifts from `docs/permission-matrix.md`, and builds the web app and the API.
- Never commit `.env*`, secrets, generated output (`dist/`, `apps/api/src/generated/`, `packages/tokens/dist/`) or real guest data; the seed and fixtures are synthetic.

## Records

- Technical and process decisions: D-records in the vault (`vault/notes/Build decisions/`); the stack as built is D-023.
- AMPM's decisions: `docs/decisions.json`, then `python3 docs/tools/apply_decisions.py` and the generators listed in `docs/README.md`.
- Each session's narrative: the session note in `vault/notes/Sessions/`, written at every wrap-up.
- The knowledge graph: `graphify update .` after code changes; `/graphify . --update` in a session when documents change.
