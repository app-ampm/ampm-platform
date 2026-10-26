---
paths:
  - "apps/api/**"
  - "packages/core/**"
  - "packages/policy/**"
  - "packages/api-client/**"
---
# API, domain and integration rules

- New endpoint, in order: (1) Zod request and response schemas in `packages/core/src/schemas/<domain>.ts`, types via `z.infer`; (2) controller in `apps/api/src/modules/<module>/` validating with that schema (`nestjs-zod`), thin: parse → call service → map result or error to the envelope; (3) service holding the business rule, the permission check and the status transition, no HTTP; (4) repository holding Prisma queries with the scoping filters (membership, demo flag, visibility, soft delete), no business rules; (5) TanStack Query hook in `packages/api-client`.
- Modules mirror `docs/data-model.md` modules A to Q (architecture §5). Dependencies point downward only; a module never queries another module's tables; cross-module reactions go through domain events handled by the worker.
- Response envelope: `{ data }` on success; `{ error: { code, message, details? } }` with the correct status on failure. Error codes are an enum in `packages/core/src/errors.ts`.
- Authentication: the identity service's token is verified in middleware; handlers receive the principal (staff, client, demo, guest, system). Authorisation is checked in the service, every time, through `packages/policy`. Never trust a client-supplied identifier for ownership: look it up and compare.
- Lists are cursor-paginated by default and return `nextCursor`.
- Validate every input at the edge, including params and headers. Structured logging with a request id; never log secrets, tokens or personal data.
- `packages/core` and `packages/policy` stay pure: no React, no Node APIs, no fetch. They must run in browser, native and server.
- Apps never hand-write fetch calls; they use the typed client from `packages/api-client`.
- Integrations: one adapter interface per provider (payments, email, WhatsApp, SMS, push, video, maps, identity); one implementation behind it; a sandbox configuration for development and staging; a contract test against the sandbox in CI. Business logic never imports a provider SDK.
- Webhooks: verify the provider signature, store the raw event, process through an idempotent job keyed on the provider reference. Subscription activation happens once per transaction whatever the number of notifications.
- Jobs (BullMQ): idempotent, with an idempotency key and a recorded outcome; retries with backoff; dead-letter after the configured attempts; nothing in Redis is the only copy of anything.
- Real time: the chat and notification channel is a WebSocket gateway on the API with Redis as the bus; the same principal and permission checks apply to every socket event.
- Configuration, not code: plans, prices, demo limits, categories, thresholds, labels, templates, approval settings and feature switches are `configurations` rows read through one typed accessor.
