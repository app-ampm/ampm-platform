-- CreateEnum
CREATE TYPE "HotelEnquiryStatus" AS ENUM ('draft', 'submitted', 'awaiting_hotel', 'response_received', 'negotiating', 'visit_scheduled', 'proposal_received', 'client_decision', 'confirmed', 'closed');

-- CreateEnum
CREATE TYPE "HotelEnquiryOutcome" AS ENUM ('booked', 'declined', 'no_availability', 'withdrawn');

-- CreateEnum
CREATE TYPE "HotelEnquiryEventType" AS ENUM ('submitted', 'sent_to_hotel', 'hotel_response', 'negotiation_note', 'client_update', 'status_change', 'visit', 'proposal');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('proposal', 'contract', 'invoice', 'design', 'menu', 'schedule', 'rooming_list', 'rider', 'ticket', 'consent', 'other');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('internal', 'client', 'guest', 'public');

-- CreateTable
CREATE TABLE "hotel_enquiries" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "project_id" UUID,
    "hotel_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "service_agreement_id" UUID,
    "status" "HotelEnquiryStatus" NOT NULL DEFAULT 'draft',
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "dates_flexible" BOOLEAN NOT NULL DEFAULT false,
    "guest_estimate" INTEGER NOT NULL,
    "rooms_required" INTEGER,
    "functions_summary" TEXT,
    "contact_preference" VARCHAR(255),
    "notes_client" TEXT,
    "notes_internal" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "outcome" "HotelEnquiryOutcome",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_enquiry_events" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "event_type" "HotelEnquiryEventType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "summary" TEXT,
    "internal_only" BOOLEAN NOT NULL DEFAULT false,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_enquiry_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "account_id" UUID,
    "owner_type" VARCHAR(255) NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "size_bytes" INTEGER,
    "checksum" VARCHAR(255),
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" UUID,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'internal',
    "uploaded_by" UUID NOT NULL,
    "retention_class" VARCHAR(255),
    "retention_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_links" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "max_downloads" INTEGER NOT NULL DEFAULT 1,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_access_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_enquiries_account_id_status_idx" ON "hotel_enquiries"("account_id", "status");

-- CreateIndex
CREATE INDEX "hotel_enquiries_project_id_status_idx" ON "hotel_enquiries"("project_id", "status");

-- CreateIndex
CREATE INDEX "hotel_enquiries_hotel_id_idx" ON "hotel_enquiries"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_enquiries_assigned_user_id_status_idx" ON "hotel_enquiries"("assigned_user_id", "status");

-- CreateIndex
CREATE INDEX "hotel_enquiries_requested_by_user_id_idx" ON "hotel_enquiries"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "hotel_enquiries_service_agreement_id_idx" ON "hotel_enquiries"("service_agreement_id");

-- CreateIndex
CREATE INDEX "hotel_enquiries_deleted_at_idx" ON "hotel_enquiries"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_enquiry_events_enquiry_id_occurred_at_idx" ON "hotel_enquiry_events"("enquiry_id", "occurred_at");

-- CreateIndex
CREATE INDEX "hotel_enquiry_events_document_id_idx" ON "hotel_enquiry_events"("document_id");

-- CreateIndex
CREATE INDEX "hotel_enquiry_events_user_id_idx" ON "hotel_enquiry_events"("user_id");

-- CreateIndex
CREATE INDEX "hotel_enquiry_events_deleted_at_idx" ON "hotel_enquiry_events"("deleted_at");

-- CreateIndex
CREATE INDEX "documents_owner_type_owner_id_idx" ON "documents"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "documents_account_id_idx" ON "documents"("account_id");

-- CreateIndex
CREATE INDEX "documents_previous_version_id_idx" ON "documents"("previous_version_id");

-- CreateIndex
CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");

-- CreateIndex
CREATE INDEX "document_access_links_document_id_idx" ON "document_access_links"("document_id");

-- CreateIndex
CREATE INDEX "document_access_links_expires_at_idx" ON "document_access_links"("expires_at");

-- CreateIndex
CREATE INDEX "document_access_links_deleted_at_idx" ON "document_access_links"("deleted_at");

-- AddForeignKey
ALTER TABLE "hotel_enquiry_events" ADD CONSTRAINT "hotel_enquiry_events_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "hotel_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_links" ADD CONSTRAINT "document_access_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
