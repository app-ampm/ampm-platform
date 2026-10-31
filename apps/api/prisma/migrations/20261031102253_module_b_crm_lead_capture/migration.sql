-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'introduction_shared', 'demo_offered', 'demo_accessed', 'follow_up', 'converted', 'closed');

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('phone', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'consultation', 'demo', 'questionnaire', 'call_request', 'note');

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "source_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(32),
    "contact_preference" "ContactPreference",
    "tentative_date_from" DATE,
    "tentative_date_to" DATE,
    "destination_id" UUID,
    "destination_text" VARCHAR(255),
    "guest_estimate" INTEGER,
    "requirements" TEXT,
    "consent_marketing" BOOLEAN NOT NULL DEFAULT false,
    "consent_at" TIMESTAMPTZ(6),
    "consent_notice_version" VARCHAR(32),
    "requested_demo" BOOLEAN NOT NULL DEFAULT false,
    "owner_user_id" UUID,
    "converted_account_id" UUID,
    "converted_at" TIMESTAMPTZ(6),
    "closed_reason" VARCHAR(255),
    "duplicate_of_lead_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "activity_type" "LeadActivityType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "summary" TEXT,
    "questionnaire_json" JSONB,
    "next_follow_up_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_source_key_key" ON "lead_sources"("source_key");

-- CreateIndex
CREATE INDEX "lead_sources_deleted_at_idx" ON "lead_sources"("deleted_at");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_source_id_idx" ON "leads"("source_id");

-- CreateIndex
CREATE INDEX "leads_owner_user_id_status_idx" ON "leads"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_duplicate_of_lead_id_idx" ON "leads"("duplicate_of_lead_id");

-- CreateIndex
CREATE INDEX "leads_deleted_at_idx" ON "leads"("deleted_at");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_occurred_at_idx" ON "lead_activities"("lead_id", "occurred_at");

-- CreateIndex
CREATE INDEX "lead_activities_next_follow_up_at_idx" ON "lead_activities"("next_follow_up_at");

-- CreateIndex
CREATE INDEX "lead_activities_user_id_idx" ON "lead_activities"("user_id");

-- CreateIndex
CREATE INDEX "lead_activities_deleted_at_idx" ON "lead_activities"("deleted_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_duplicate_of_lead_id_fkey" FOREIGN KEY ("duplicate_of_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
