-- CreateEnum
CREATE TYPE "BookingMilestoneStatus" AS ENUM ('pending', 'done', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "BookingMilestoneType" AS ENUM ('hold_placed', 'contract_sent', 'contract_signed', 'advance_paid', 'rooming_list_due', 'balance_due', 'confirmed');

-- CreateTable
CREATE TABLE "booking_milestones" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "project_id" UUID,
    "milestone_type" "BookingMilestoneType" NOT NULL,
    "status" "BookingMilestoneStatus" NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "contract_id" UUID,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "booking_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_milestones_enquiry_id_status_idx" ON "booking_milestones"("enquiry_id", "status");

-- CreateIndex
CREATE INDEX "booking_milestones_status_due_at_idx" ON "booking_milestones"("status", "due_at");

-- CreateIndex
CREATE INDEX "booking_milestones_project_id_idx" ON "booking_milestones"("project_id");

-- CreateIndex
CREATE INDEX "booking_milestones_contract_id_idx" ON "booking_milestones"("contract_id");

-- CreateIndex
CREATE INDEX "booking_milestones_document_id_idx" ON "booking_milestones"("document_id");

-- CreateIndex
CREATE INDEX "booking_milestones_deleted_at_idx" ON "booking_milestones"("deleted_at");

-- AddForeignKey
ALTER TABLE "booking_milestones" ADD CONSTRAINT "booking_milestones_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "hotel_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
