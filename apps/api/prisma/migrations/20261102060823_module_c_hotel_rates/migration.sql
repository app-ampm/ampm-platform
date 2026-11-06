-- CreateEnum
CREATE TYPE "HotelVerificationFieldGroup" AS ENUM ('profile', 'rooms', 'venues', 'rates', 'availability', 'media', 'contacts');

-- CreateEnum
CREATE TYPE "HotelVerificationSource" AS ENUM ('phone', 'email', 'site_visit', 'website', 'contract');

-- CreateEnum
CREATE TYPE "HotelVerificationStatus" AS ENUM ('verified', 'unverified', 'stale');

-- CreateEnum
CREATE TYPE "HotelRateCardStatus" AS ENUM ('draft', 'verified', 'stale', 'retired');

-- CreateEnum
CREATE TYPE "HotelRateItemType" AS ENUM ('room_rate', 'venue_rental', 'per_plate_veg', 'per_plate_non_veg', 'wedding_package', 'beverage_package', 'service_charge', 'tax', 'other');

-- CreateEnum
CREATE TYPE "HotelRateItemUnit" AS ENUM ('per_night', 'per_plate', 'per_event', 'percent');

-- CreateTable
CREATE TABLE "hotel_verifications" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "field_group" "HotelVerificationFieldGroup" NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "source" "HotelVerificationSource",
    "status" "HotelVerificationStatus" NOT NULL DEFAULT 'unverified',
    "next_due_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rate_cards" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "valid_from" DATE,
    "valid_to" DATE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "HotelRateCardStatus" NOT NULL DEFAULT 'draft',
    "verification_id" UUID,
    "source" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rate_items" (
    "id" UUID NOT NULL,
    "rate_card_id" UUID NOT NULL,
    "item_type" "HotelRateItemType" NOT NULL,
    "room_category_id" UUID,
    "venue_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "amount_max" DECIMAL(14,2),
    "is_indicative" BOOLEAN NOT NULL DEFAULT true,
    "unit" "HotelRateItemUnit" NOT NULL,
    "min_quantity" INTEGER,
    "inclusions_text" TEXT,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_rate_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_verifications_hotel_id_idx" ON "hotel_verifications"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_verifications_status_idx" ON "hotel_verifications"("status");

-- CreateIndex
CREATE INDEX "hotel_verifications_deleted_at_idx" ON "hotel_verifications"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_rate_cards_hotel_id_idx" ON "hotel_rate_cards"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_rate_cards_status_idx" ON "hotel_rate_cards"("status");

-- CreateIndex
CREATE INDEX "hotel_rate_cards_verification_id_idx" ON "hotel_rate_cards"("verification_id");

-- CreateIndex
CREATE INDEX "hotel_rate_cards_deleted_at_idx" ON "hotel_rate_cards"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_rate_items_rate_card_id_idx" ON "hotel_rate_items"("rate_card_id");

-- CreateIndex
CREATE INDEX "hotel_rate_items_room_category_id_idx" ON "hotel_rate_items"("room_category_id");

-- CreateIndex
CREATE INDEX "hotel_rate_items_venue_id_idx" ON "hotel_rate_items"("venue_id");

-- CreateIndex
CREATE INDEX "hotel_rate_items_deleted_at_idx" ON "hotel_rate_items"("deleted_at");

-- AddForeignKey
ALTER TABLE "hotel_verifications" ADD CONSTRAINT "hotel_verifications_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rate_cards" ADD CONSTRAINT "hotel_rate_cards_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rate_cards" ADD CONSTRAINT "hotel_rate_cards_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "hotel_verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rate_items" ADD CONSTRAINT "hotel_rate_items_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "hotel_rate_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rate_items" ADD CONSTRAINT "hotel_rate_items_room_category_id_fkey" FOREIGN KEY ("room_category_id") REFERENCES "hotel_room_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rate_items" ADD CONSTRAINT "hotel_rate_items_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "hotel_venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
