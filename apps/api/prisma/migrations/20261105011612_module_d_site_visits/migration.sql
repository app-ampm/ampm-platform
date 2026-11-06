-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('proposed', 'confirmed', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "site_visits" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'proposed',
    "attendees_text" TEXT,
    "outcome_internal" TEXT,
    "client_feedback" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_visits_enquiry_id_status_idx" ON "site_visits"("enquiry_id", "status");

-- CreateIndex
CREATE INDEX "site_visits_hotel_id_idx" ON "site_visits"("hotel_id");

-- CreateIndex
CREATE INDEX "site_visits_deleted_at_idx" ON "site_visits"("deleted_at");

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "hotel_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
