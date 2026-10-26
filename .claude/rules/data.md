---
paths:
  - "apps/api/prisma/**"
  - "apps/api/src/db/**"
  - "apps/api/src/modules/**/repositories/**"
---
# Data rules (from docs/data-model.md §1)

- The Prisma schema mirrors `docs/data-model.md`; a change to the model updates the document and the schema in the same task. Field types, enumerations and constraints come from `docs/field-matrix.md`.
- Keys: UUID v7 `id`; foreign keys `<table_singular>_id`; human codes (`AMPM-2027-014`) are separate unique columns. Every foreign key is indexed; composite indexes on `(project_id, status)` for project-owned tables; partial indexes on `deleted_at IS NULL`.
- Every table: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`. Wedding, guest and finance records are never hard-deleted; only retention jobs delete, and only after a Super Admin approves the proposal.
- Money: `numeric(14,2)` plus a `currency` column (INR default); no floating point on the money path; totals computed in the database or with decimal arithmetic. Client-facing and internal amounts are always separate columns, never one column with a flag.
- Statuses are enumerations fixed in code; their labels are configuration. Reference tables the Super Admin edits: lead sources, plans, service types, function types, budget and vendor categories, checklist templates.
- Immutable once shared: design, menu and invitation versions, vendor and hotel proposals; approvals reference the exact version; a change creates a new version.
- Time stored in UTC, displayed in the wedding's time zone.
- Partitioning: `audit_events` and `notifications` by month from day one; partitions, row-level security policies, the hotel search view and trigram indexes are raw SQL migrations, committed and never hand-edited after they run.
- Migrations are expand-and-contract: add first, deploy code that writes both, backfill, remove in a later release. No destructive migration ships with the code that depends on it.
- Demo isolation: demo accounts and projects carry `is_demo`; hotels carry `demo_visible`; the repository layer filters every query for a demo principal; a nightly job restores demo data from the seed.
- Seed and fixtures are synthetic: fictitious names, reserved phone ranges, example-domain emails, generated images. Never real guest data outside production.
