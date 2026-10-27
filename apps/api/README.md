# apps/api

The AMPM API and worker: NestJS 12 with Prisma 7 on PostgreSQL 16. Setup and the common scripts are in the root [README](../../README.md); the rules are `.claude/rules/api.md`, `security.md` and `data.md`.

- `src/common/` request context, logger, the error filter and the envelope interceptor, Zod parameter decorators
- `src/identity/` the identity adapters (Cognito, local development) behind one interface
- `src/policy/` the pipeline: `AuthGuard`, `PermissionGuard`, principal resolution, entitlement cache, audit
- `src/db/` the Prisma service and the repository scoping helpers
- `src/modules/<module>/` one folder per data-model module (A to Q): controllers, services, repositories
- `prisma/` the schema (mirrors `docs/data-model.md`), migrations and the synthetic seed
- `test/` the supertest e2e suite, run against `DATABASE_URL_TEST`

```bash
pnpm --filter api dev          # http://localhost:3900 (nest start --watch)
pnpm --filter api test         # unit tests, then the e2e suite
pnpm --filter api db:migrate   # a new migration from the schema
pnpm --filter api dev:token local:admin
```
