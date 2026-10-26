---
paths:
  - "apps/**"
  - "packages/**"
---
# Engineering rules for all code (apps/ and packages/)

Universal product: public website (Next.js), client and team apps (Expo, iOS, Android, tablets, web export of the client portals), API (NestJS + Prisma). TypeScript everywhere. pnpm + Turborepo. Scope `@ampm`. These rules override defaults; if a rule blocks the obvious shortcut, follow the rule and say so. The full standards are in `docs/engineering/standards.md`.

## Commands
- Node 24 through nvm (`nvm use` reads `.nvmrc`); pnpm 12 through corepack
- `pnpm dev` all apps · `pnpm dev --filter=web|mobile|api` one app (pick free ports: 3000, 3100 and 8081 are taken on the development machine)
- `pnpm check` = lint + typecheck + test. Run it before reporting any task as done.
- `pnpm db:generate` after editing the Prisma schema · `pnpm db:migrate` to apply · `pnpm authz:generate` after editing `packages/policy`
- Native dependencies: `pnpm --filter mobile exec expo install <pkg>`, never plain `pnpm add` for packages with native code

## Layout and dependency direction
- `apps/web` public website only · `apps/mobile` client and team apps · `apps/api` API and worker entry points
- `packages/tokens` the ONLY place colours, spacing, radii, type scale and motion are defined
- `packages/ui` universal components and UI-only hooks · `packages/core` pure TypeScript, no React, no I/O
- `packages/policy` permission keys, scopes, visibility classes, transitions; the only place they exist
- `packages/api-client` typed client + TanStack Query hooks · `packages/config` shared eslint, tsconfig, prettier, tailwind presets
- apps → packages · ui → tokens, core · api-client → core, policy · policy → core. Packages never import apps. Lint enforces this.
- Features: `apps/<app>/src/features/<feature>/{screens|pages,components,hooks}`. No `utils/` dumping grounds.
- A new pattern or dependency category gets a build-decision record (`python3 docs/tools/new_decision.py`) before code.

## Reuse first (the most important rule)
1. Before creating any component, hook, util, type, schema or constant: search `packages/` by concept (`rg -i "modal|dialog|sheet" packages/`). Extend what exists.
2. Anything used by two apps, two features or two screens lives in `packages/`. Never copy-paste between apps.
3. Variants are props (`variant="secondary"`, `size="sm"`), not new components.
4. New shared code: export from the package `index.ts`, JSDoc with a usage example, test alongside.
5. If reuse needs a breaking change to a shared API, make it and update every caller in the same task.

## Architecture
- `packages/ui` is presentational: no fetching, no business rules, no navigation. Data in via props, actions out via callbacks.
- Server state = TanStack Query (hooks in `packages/api-client`). UI state = one Zustand store per feature. Forms = react-hook-form + the Zod schema from `packages/core`. Never copy server data into a store.
- Contract-first: Zod schema in `packages/core` → API validation → typed client. One schema, three consumers.
- Navigation stays in the app (Expo Router, Next.js). Shared screens compose `packages/ui` and feature hooks.
- Errors: typed errors from `packages/core/errors`; the API maps them to the standard envelope; UI shows them through the shared `ErrorState` or toast, never raw messages.
- Env vars are read once per app in a Zod-validated `env.ts`. `process.env` nowhere else.

## Code standards
- TypeScript strict. No `any`, no `as` to silence errors, no `@ts-ignore`. Use `unknown` and narrowing.
- Named exports only. One component per file. Files `kebab-case.tsx`; components and types `PascalCase`; hooks `useX`; constants `SCREAMING_SNAKE`; booleans `isX/hasX/canX`.
- Functions at most 40 lines, files at most 300; split before exceeding.
- No hardcoded colours, spacing, font sizes or user-facing strings: tokens and i18n keys only.
- No `console.*` in committed code; use the logger from `packages/core`.
- Comments explain why, not what. No commented-out code.
- Ask before adding a dependency; prefer what the repo has; install in the correct workspace.
- React and React Native versions are dictated by the Expo SDK; the web app uses the same React.

## Accessibility and UX (non-negotiable)
- Every interactive element: accessible label, 44×44 minimum target, visible focus state on web.
- Every screen handles loading, empty, error and offline states with the shared components.
- Contrast at least 4.5:1; never convey meaning by colour alone; respect reduced motion and font scaling.

## Testing
- Vitest for `packages/core`, `packages/policy` and API services; React Native Testing Library for component behaviour and states (no snapshot tests); Playwright (web) and Maestro (mobile) for critical flows; a contract test per provider adapter against its sandbox; the generated authorisation suite always green.
- Tests live next to the code. A bug fix starts with a failing test.

## Git
- Branches `feat|fix|chore/<short-name>`. Conventional Commits (`feat(ui): add Sheet`). Small, focused commits.
- Never commit secrets, `.env*` or generated files. Never force-push shared branches.

## Definition of done
`pnpm check` green · all states and accessibility covered · shared code exported, documented, tested · no TODO without an issue link · the summary lists what was reused and what was added to `packages/`.

## When unsure
Stop and ask with two or three concrete options. Do not invent a new pattern or silently deviate from these rules.
