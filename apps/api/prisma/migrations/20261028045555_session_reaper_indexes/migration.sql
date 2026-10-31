-- CreateIndex
CREATE INDEX "sessions_revoked_at_idx" ON "sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "sessions_last_seen_at_idx" ON "sessions"("last_seen_at");
