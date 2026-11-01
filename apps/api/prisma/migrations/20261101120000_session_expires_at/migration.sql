-- Keep each session row until its access token expires (A2). The reaper now deletes only expired rows,
-- so a revoked or idle-expired session stays denied (session.service.useExisting) while its token is
-- still valid, instead of being deleted and then reopened by that still-valid token (session.service.touch).
ALTER TABLE "sessions" ADD COLUMN "expires_at" TIMESTAMPTZ(6);

-- Backfill existing rows to a safe upper bound of their token's life (<= 24h from creation), so revoke
-- and idle state survives this deploy for in-flight tokens; every new row carries the token's real expiry.
UPDATE "sessions" SET "expires_at" = "created_at" + interval '24 hours' WHERE "expires_at" IS NULL;

ALTER TABLE "sessions" ALTER COLUMN "expires_at" SET NOT NULL;

-- The reaper's new sweep key. The old revoked_at / last_seen_at reaper indexes are no longer used by it.
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
DROP INDEX IF EXISTS "sessions_revoked_at_idx";
DROP INDEX IF EXISTS "sessions_last_seen_at_idx";
