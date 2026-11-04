-- At most one OPEN (non-closed, live) enquiry per account + hotel. This backstops the application-level
-- idempotency in the enquiry-create path (AC-26.1): a concurrent double-submit for the same hotel hits
-- this constraint on the second insert, which the service catches and resolves to the first row, so a
-- double-click yields one enquiry, not two. Prisma cannot express a partial unique index, so it is a
-- raw-SQL migration (committed; never hand-edited after it runs). A closed enquiry is excluded, so a
-- client may raise a fresh enquiry for the same hotel once the prior one is closed.
CREATE UNIQUE INDEX "hotel_enquiries_account_hotel_open_key"
  ON "hotel_enquiries" ("account_id", "hotel_id")
  WHERE "status" <> 'closed' AND "deleted_at" IS NULL;
