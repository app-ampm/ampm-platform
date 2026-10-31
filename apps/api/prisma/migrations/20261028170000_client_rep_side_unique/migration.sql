-- Q5 cap, enforced at the database (feature 5.3). A partial unique index guarantees at most one LIVE
-- client-representative per (wedding, side); because only two sides exist, that also bounds a wedding
-- to two client logins. The service pre-checks this for a friendly error, but only this index is
-- race-safe: two concurrent creates cannot both land a bride-side rep. Rows with a NULL client_side
-- (staff / project_lead memberships) and removed or soft-deleted reps are excluded, so a side frees up
-- when its rep is removed. Partial indexes are not expressible in schema.prisma, hence this raw
-- migration (as with the partitioning migration); `prisma migrate deploy` applies it.
CREATE UNIQUE INDEX "project_members_live_client_side_key"
  ON "project_members" ("project_id", "client_side")
  WHERE "deleted_at" IS NULL AND "status" <> 'removed' AND "client_side" IS NOT NULL;
