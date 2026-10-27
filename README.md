# AMPM Platform

Wedding-planning platform for AMPM: a client app and a team app (iOS, Android, tablets, with a browser version of the client portals), a public website and an API. One developer builds it with Claude Code; the design package in `docs/` says what is built, `docs/engineering/standards.md` says how, and `CLAUDE.md` is the short version every coding session reads.

**Where things stand (26 October 2026).** The design package is at version 0.2 with AMPM's decisions applied; two points remain open and are tracked in the decision log. The code bootstrap is complete (standards §2.7, steps 1 to 6): the monorepo, the design tokens and styling, the quality gates, the UI foundation with its gallery, the domain, policy and API skeleton with `/health` and `/me`, and this handover. Sprint 2 starts the first features.

## Repository layout

```
apps/
  web/        public website (Next.js 16), port 3417 in development
  mobile/     client and team apps (Expo SDK 58, Expo Router); Metro on port 8082, web export included
  api/        API and worker (NestJS 12, Prisma 7), port 3900 in development
packages/
  tokens/     design tokens, the only place theme values exist; generates the Tailwind preset
  ui/         universal components on React Native primitives and NativeWind, with stories and a gallery
  core/       pure TypeScript: errors and envelope, logger, Zod schemas, i18n, money
  policy/     the permission matrix as code, generated from docs/permission-matrix.md
  api-client/ typed client and TanStack Query hooks
  config/     shared TypeScript and ESLint configuration (import boundaries)
docs/         the design package (start with docs/README.md) and the engineering standards
.claude/      rules by path, hooks, settings for Claude Code sessions
vault/        the Obsidian vault, a separate repository synced automatically
graphify-out/ the knowledge graph of the package and the code
```

## Setting up a new machine

Prerequisites: macOS or Linux with Git, the GitHub CLI `gh` signed in as app-ampm (`gh auth login`), [nvm](https://github.com/nvm-sh/nvm), PostgreSQL 16, `jq`, and for the native apps Xcode with an iPhone and an iPad simulator (Android Studio for Android). On a Mac the Homebrew formula is keg-only, so link and start it: `brew install postgresql@16 && brew link --force postgresql@16 && brew services start postgresql@16`. Claude Code sessions also need `bash docs/tools/setup_git.sh` (repository identities and the vault) and `bash docs/tools/setup_memory.sh` (session memory and the graph, which needs `uv`: `brew install uv`); see "Repositories and the Obsidian vault" in `docs/README.md`.

```bash
gh repo clone app-ampm/ampm-platform && cd ampm-platform   # HTTPS, so pushes go through the app-ampm credential helper
nvm install            # Node 24 from .nvmrc
node --version         # must print v24.x; if not, put nvm before any Homebrew node in PATH
corepack enable        # pnpm 12 from the packageManager field
pnpm install           # also builds tokens, core and policy and installs the git hooks
```

Databases and the API's environment:

```bash
createdb ampm && createdb ampm_test
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL and DATABASE_URL_TEST to your PostgreSQL user; keep IDENTITY_PROVIDER=local
                                          # and set IDENTITY_LOCAL_SECRET to the output of `openssl rand -base64 48`
pnpm db:generate                          # the Prisma client
pnpm --filter api db:deploy               # the migrations
pnpm --filter api db:seed                 # synthetic roles, permissions and four accounts
```

Every API script reads `apps/api/.env` (Prisma through `prisma.config.ts`, Nest through `--env-file`); a variable already set in the shell wins over the file, except under `pnpm dev`, where Turborepo passes only declared variables and the file decides.

The mobile app reads `apps/mobile/.env` (`EXPO_PUBLIC_API_URL`, default `http://localhost:3900`, and, in development only, `EXPO_PUBLIC_DEV_ACCESS_TOKEN`). Create it and mint a development token for a seeded account:

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter api dev:token local:admin   # also local:pm, local:client, local:disabled; paste it into apps/mobile/.env
```

Production never accepts these tokens: the API refuses the local identity provider outside development and test, and real sign-in goes through Amazon Cognito (Mumbai).

## Running and checking

```bash
pnpm dev --filter=api        # http://localhost:3900/health
pnpm dev --filter=mobile     # Metro on 8082; press i for the iPhone simulator, open http://localhost:8082 for the web build
pnpm dev --filter=web        # http://localhost:3417
pnpm check                   # lint + typecheck + test, then the docs/tools tests (pnpm test:tools); the definition of done's first line
pnpm --filter mobile bundle:check   # the Expo bundles for web, iOS and Android, as CI builds them
pnpm format                  # Prettier with Tailwind class sorting
pnpm authz:generate          # regenerate packages/policy from docs/permission-matrix.md (CI fails on drift)
pnpm tokens:build            # regenerate the Tailwind preset from packages/tokens
```

Ports 3000, 3100 and 8081 are taken by other projects on the development Mac, hence 3417, 8082 and 3900. To use other ports, set `PORT` in `apps/api/.env` (and `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`), pass `-- --port <n>` to the mobile dev command, and list the new web origin in `CORS_ORIGINS` in `apps/api/.env`. The API's end-to-end tests migrate and seed `DATABASE_URL_TEST` on every run; run them alone with `pnpm --filter api test:e2e`. `pnpm check` runs them too, so PostgreSQL must be up; CI runs them against a PostgreSQL service container.

## How the work is done

`CLAUDE.md` holds the rules every session follows; `.claude/rules/` holds the rules by path (code, UI, styling, API, security, offline, data, infrastructure); `docs/engineering/standards.md` holds the standards with the reasons; `docs/CONTRIBUTING.md` is the working method for a feature and a merge. Every turn ends with a typecheck and a checkpoint commit, every commit runs Prettier, ESLint and commitlint, and every push runs the CI workflow. Technical decisions are D-records in the vault (`python3 docs/tools/new_decision.py`); AMPM's decisions are in `docs/decisions.json` and the generated `docs/decision-log.md`.

Decisions, assumptions, findings and open items live as notes in the Obsidian vault, a separate private repository, [ampm-vault](https://github.com/app-ampm/ampm-vault), checked out at `vault/` and kept in sync automatically. Every Claude Code session here is remembered: transcripts are mined into a local MemPalace wing and the knowledge graph in `graphify-out/` covers the package and the code; "Session memory and the knowledge graph" in `docs/README.md` explains both.

AMPM's own brief and answers are in [reference_docs](reference_docs/).
