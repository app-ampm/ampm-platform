-- GP-20 backstop (feature 9.3 slice 5c): a previous-wedding reference may be client_visible ONLY when a
-- consent document is recorded. The service gate enforces this per request, but it is check-then-act; this
-- database CHECK makes the invariant hold regardless of request interleaving (a concurrent pair of PATCHes
-- cannot commit a client-visible reference with no consent). Postgres CHECK constraints are not expressible
-- in schema.prisma, so `prisma migrate dev` reports this as drift; CI/test/prod use `prisma migrate deploy`,
-- which applies and enforces it. See the slice-5c decision record.
ALTER TABLE "hotel_wedding_references"
  ADD CONSTRAINT "hotel_wedding_references_client_visible_requires_consent"
  CHECK (NOT "client_visible" OR "consent_document_id" IS NOT NULL);
