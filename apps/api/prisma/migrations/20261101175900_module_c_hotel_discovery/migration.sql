-- CreateEnum
CREATE TYPE "DestinationStatus" AS ENUM ('draft', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "HotelStatus" AS ENUM ('draft', 'active', 'inactive');

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "region" VARCHAR(255),
    "state" VARCHAR(255),
    "country" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "DestinationStatus" NOT NULL DEFAULT 'draft',
    "public_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "brand" VARCHAR(255),
    "star_category" VARCHAR(255),
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "description_client" TEXT,
    "website" VARCHAR(255),
    "status" "HotelStatus" NOT NULL DEFAULT 'draft',
    "demo_visible" BOOLEAN NOT NULL DEFAULT false,
    "public_showcase" BOOLEAN NOT NULL DEFAULT false,
    "internal_rating" INTEGER,
    "internal_notes" TEXT,
    "total_rooms" INTEGER,
    "street_view_ref" VARCHAR(255),
    "last_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_hotels" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "project_id" UUID,
    "saved_by_user_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "saved_hotels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "destinations_status_idx" ON "destinations"("status");

-- CreateIndex
CREATE INDEX "destinations_deleted_at_idx" ON "destinations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_slug_key" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "hotels_destination_id_idx" ON "hotels"("destination_id");

-- CreateIndex
CREATE INDEX "hotels_status_demo_visible_idx" ON "hotels"("status", "demo_visible");

-- CreateIndex
CREATE INDEX "hotels_deleted_at_idx" ON "hotels"("deleted_at");

-- CreateIndex
CREATE INDEX "saved_hotels_account_id_idx" ON "saved_hotels"("account_id");

-- CreateIndex
CREATE INDEX "saved_hotels_hotel_id_idx" ON "saved_hotels"("hotel_id");

-- CreateIndex
CREATE INDEX "saved_hotels_deleted_at_idx" ON "saved_hotels"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_hotels_account_id_hotel_id_key" ON "saved_hotels"("account_id", "hotel_id");

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_hotels" ADD CONSTRAINT "saved_hotels_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "client_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_hotels" ADD CONSTRAINT "saved_hotels_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
