-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('hotel_assistance', 'design', 'vendor_coordination', 'full_management', 'other');

-- CreateEnum
CREATE TYPE "ServiceFeeStructure" AS ENUM ('fixed', 'percentage', 'milestones');

-- CreateEnum
CREATE TYPE "ServiceAgreementStatus" AS ENUM ('draft', 'sent', 'accepted', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "service_types" (
    "id" UUID NOT NULL,
    "service_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_agreements" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "project_id" UUID,
    "service_type_id" UUID NOT NULL,
    "hotel_enquiry_id" UUID,
    "scope_text" TEXT NOT NULL,
    "fee_amount" DECIMAL(14,2) NOT NULL,
    "fee_structure" "ServiceFeeStructure" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "terms_version" VARCHAR(255),
    "status" "ServiceAgreementStatus" NOT NULL DEFAULT 'draft',
    "accepted_at" TIMESTAMPTZ(6),
    "accepted_by_user_id" UUID,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_types_service_key_key" ON "service_types"("service_key");

-- CreateIndex
CREATE INDEX "service_types_category_idx" ON "service_types"("category");

-- CreateIndex
CREATE INDEX "service_types_deleted_at_idx" ON "service_types"("deleted_at");

-- CreateIndex
CREATE INDEX "service_agreements_account_id_status_idx" ON "service_agreements"("account_id", "status");

-- CreateIndex
CREATE INDEX "service_agreements_service_type_id_idx" ON "service_agreements"("service_type_id");

-- CreateIndex
CREATE INDEX "service_agreements_hotel_enquiry_id_idx" ON "service_agreements"("hotel_enquiry_id");

-- CreateIndex
CREATE INDEX "service_agreements_project_id_idx" ON "service_agreements"("project_id");

-- CreateIndex
CREATE INDEX "service_agreements_status_idx" ON "service_agreements"("status");

-- CreateIndex
CREATE INDEX "service_agreements_deleted_at_idx" ON "service_agreements"("deleted_at");

-- AddForeignKey
ALTER TABLE "service_agreements" ADD CONSTRAINT "service_agreements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "client_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_agreements" ADD CONSTRAINT "service_agreements_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
