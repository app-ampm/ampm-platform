-- CreateEnum
CREATE TYPE "HotelProposalStatus" AS ENUM ('draft', 'shared', 'revision_requested', 'accepted', 'declined', 'superseded');

-- CreateTable
CREATE TABLE "hotel_proposals" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "HotelProposalStatus" NOT NULL DEFAULT 'draft',
    "valid_until" DATE,
    "client_total_amount" DECIMAL(14,2) NOT NULL,
    "internal_total_amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "document_id" UUID,
    "shared_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "decided_by_user_id" UUID,
    "approval_id" UUID,
    "supersedes_proposal_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_proposal_lines" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "item_type" "HotelRateItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "client_visible" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_proposal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_proposals_enquiry_id_status_idx" ON "hotel_proposals"("enquiry_id", "status");

-- CreateIndex
CREATE INDEX "hotel_proposals_hotel_id_idx" ON "hotel_proposals"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_proposals_status_idx" ON "hotel_proposals"("status");

-- CreateIndex
CREATE INDEX "hotel_proposals_deleted_at_idx" ON "hotel_proposals"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_proposals_enquiry_id_version_number_key" ON "hotel_proposals"("enquiry_id", "version_number");

-- CreateIndex
CREATE INDEX "hotel_proposal_lines_proposal_id_idx" ON "hotel_proposal_lines"("proposal_id");

-- CreateIndex
CREATE INDEX "hotel_proposal_lines_deleted_at_idx" ON "hotel_proposal_lines"("deleted_at");

-- AddForeignKey
ALTER TABLE "hotel_proposals" ADD CONSTRAINT "hotel_proposals_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "hotel_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_proposal_lines" ADD CONSTRAINT "hotel_proposal_lines_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "hotel_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
