-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('staff', 'client', 'demo');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'disabled', 'locked');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('project_lead', 'staff', 'client_representative');

-- CreateEnum
CREATE TYPE "ClientSide" AS ENUM ('bride', 'groom');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('invited', 'active', 'removed');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('invite', 'password_reset', 'otp', 'magic_link');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('user', 'guest');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'whatsapp', 'sms', 'push');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'guest_token', 'system');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'approve', 'share', 'export', 'restricted_read');

-- CreateEnum
CREATE TYPE "ConfigurationScope" AS ENUM ('global', 'project');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('hotels', 'guests', 'vendors');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('uploaded', 'validating', 'failed', 'applied');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "user_type" "UserType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32),
    "status" "UserStatus" NOT NULL DEFAULT 'invited',
    "identity_subject" VARCHAR(255),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "role_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "permission_key" VARCHAR(160) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "project_role" "ProjectRole" NOT NULL,
    "client_side" "ClientSide",
    "can_view_finance" BOOLEAN NOT NULL DEFAULT false,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,
    "status" "MembershipStatus" NOT NULL DEFAULT 'invited',
    "invited_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "channel" VARCHAR(32) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configurations" (
    "id" UUID NOT NULL,
    "config_key" VARCHAR(128) NOT NULL,
    "value_json" JSONB NOT NULL,
    "scope" "ConfigurationScope" NOT NULL DEFAULT 'global',
    "scope_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "import_type" "ImportType" NOT NULL,
    "project_id" UUID,
    "file_document_id" UUID,
    "status" "ImportStatus" NOT NULL DEFAULT 'uploaded',
    "row_count" INTEGER,
    "error_report_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_identity_subject_key" ON "users"("identity_subject");

-- CreateIndex
CREATE INDEX "users_user_type_status_idx" ON "users"("user_type", "status");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_key_key" ON "roles"("role_key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_permission_key_key" ON "permissions"("permission_key");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "project_members_project_id_status_idx" ON "project_members"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_members_user_id_status_idx" ON "project_members"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "auth_tokens_expires_at_idx" ON "auth_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_type_recipient_id_status_idx" ON "notifications"("recipient_type", "recipient_id", "status");

-- CreateIndex
CREATE INDEX "notifications_entity_type_entity_id_idx" ON "notifications"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_event_type_channel_key" ON "notification_preferences"("user_id", "event_type", "channel");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_occurred_at_idx" ON "audit_events"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_project_id_occurred_at_idx" ON "audit_events"("project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_occurred_at_idx" ON "audit_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "configurations_config_key_key" ON "configurations"("config_key");

-- CreateIndex
CREATE INDEX "configurations_scope_scope_id_idx" ON "configurations"("scope", "scope_id");

-- CreateIndex
CREATE INDEX "import_jobs_project_id_status_idx" ON "import_jobs"("project_id", "status");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

