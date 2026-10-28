-- Monthly range partitioning for the two high-volume log tables (data.md). Each table is recreated
-- partitioned by its time column, with the composite primary key the partition key requires. On a
-- fresh database (and in Prisma's shadow DB) the module-A tables created earlier are empty, so the
-- recreate loses nothing; dev/test log rows are disposable. A DEFAULT partition catches any row
-- outside the pre-created months so no insert ever fails; a maintenance job rolls months forward.

-- audit_events: partitioned by occurred_at -----------------------------------
DROP TABLE IF EXISTS "audit_events";

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_type" "ActorType" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(255) NOT NULL,
    "entity_id" UUID NOT NULL,
    "project_id" UUID,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip_address" VARCHAR(255),
    "request_id" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id", "occurred_at")
) PARTITION BY RANGE ("occurred_at");

CREATE INDEX "audit_events_entity_type_entity_id_occurred_at_idx" ON "audit_events"("entity_type", "entity_id", "occurred_at");
CREATE INDEX "audit_events_project_id_occurred_at_idx" ON "audit_events"("project_id", "occurred_at");
CREATE INDEX "audit_events_actor_user_id_occurred_at_idx" ON "audit_events"("actor_user_id", "occurred_at");

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "audit_events_default" PARTITION OF "audit_events" DEFAULT;
CREATE TABLE "audit_events_2026_10" PARTITION OF "audit_events" FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE "audit_events_2026_11" PARTITION OF "audit_events" FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE "audit_events_2026_12" PARTITION OF "audit_events" FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE "audit_events_2027_01" PARTITION OF "audit_events" FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');

-- notifications: partitioned by created_at -----------------------------------
DROP TABLE IF EXISTS "notifications";

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_type" "RecipientType" NOT NULL,
    "recipient_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template_key" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(255),
    "entity_id" UUID,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "provider_ref" VARCHAR(255),
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

CREATE INDEX "notifications_recipient_type_recipient_id_status_idx" ON "notifications"("recipient_type", "recipient_id", "status");
CREATE INDEX "notifications_entity_type_entity_id_idx" ON "notifications"("entity_type", "entity_id");

CREATE TABLE "notifications_default" PARTITION OF "notifications" DEFAULT;
CREATE TABLE "notifications_2026_10" PARTITION OF "notifications" FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE "notifications_2026_11" PARTITION OF "notifications" FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE "notifications_2026_12" PARTITION OF "notifications" FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE "notifications_2027_01" PARTITION OF "notifications" FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');
