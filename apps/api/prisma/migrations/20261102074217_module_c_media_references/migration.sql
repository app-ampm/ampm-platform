-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('hotel', 'destination', 'vendor', 'design_version', 'invitation_version', 'project', 'cms');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('internal', 'client', 'demo', 'public');

-- CreateEnum
CREATE TYPE "MediaRightsStatus" AS ENUM ('owned', 'licensed', 'consent_required', 'consent_obtained');

-- CreateEnum
CREATE TYPE "MediaScanStatus" AS ENUM ('pending', 'clean', 'rejected');

-- AlterTable
ALTER TABLE "destinations" ADD COLUMN     "hero_media_id" UUID;

-- CreateTable
CREATE TABLE "hotel_wedding_references" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "project_id" UUID,
    "event_year" INTEGER NOT NULL,
    "guest_count" INTEGER,
    "description_client" TEXT,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "consent_document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_wedding_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_type" "MediaOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "thumbnail_key" VARCHAR(255),
    "web_key" VARCHAR(255),
    "mime_type" VARCHAR(255) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "scan_status" "MediaScanStatus" NOT NULL DEFAULT 'pending',
    "caption" VARCHAR(255),
    "sort_order" INTEGER,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'internal',
    "rights_status" "MediaRightsStatus" NOT NULL DEFAULT 'consent_required',
    "consent_source_project_id" UUID,
    "consent_document_id" UUID,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_wedding_references_hotel_id_idx" ON "hotel_wedding_references"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_wedding_references_deleted_at_idx" ON "hotel_wedding_references"("deleted_at");

-- CreateIndex
CREATE INDEX "media_assets_owner_type_owner_id_sort_order_idx" ON "media_assets"("owner_type", "owner_id", "sort_order");

-- CreateIndex
CREATE INDEX "media_assets_scan_status_idx" ON "media_assets"("scan_status");

-- CreateIndex
CREATE INDEX "media_assets_deleted_at_idx" ON "media_assets"("deleted_at");

-- AddForeignKey
ALTER TABLE "hotel_wedding_references" ADD CONSTRAINT "hotel_wedding_references_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
