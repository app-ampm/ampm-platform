-- Make users.email unique only among LIVE rows (B9). The plain unique index counted soft-deleted rows,
-- so a soft-deleted staff user or a removed client login blocked re-creating that person forever; a
-- partial unique on `deleted_at IS NULL` frees the email on delete while still refusing two live holders.
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_email_live_key" ON "users"("email") WHERE "deleted_at" IS NULL;
