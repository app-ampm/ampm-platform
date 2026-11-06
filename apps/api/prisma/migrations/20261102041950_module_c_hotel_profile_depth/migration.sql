-- CreateEnum
CREATE TYPE "HotelVenueType" AS ENUM ('ballroom', 'lawn', 'poolside', 'rooftop', 'courtyard', 'beach', 'other');

-- CreateTable
CREATE TABLE "hotel_contacts" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role_title" VARCHAR(255),
    "phone" VARCHAR(255),
    "email" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_room_categories" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "room_count" INTEGER,
    "max_occupancy" INTEGER,
    "size_sqm" INTEGER,
    "facilities_json" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_room_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_venues" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "venue_type" "HotelVenueType" NOT NULL,
    "is_indoor" BOOLEAN NOT NULL,
    "area_sqm" INTEGER,
    "capacity_banquet" INTEGER,
    "capacity_theatre" INTEGER,
    "capacity_reception" INTEGER,
    "facilities_json" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_venues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_contacts_hotel_id_idx" ON "hotel_contacts"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_contacts_deleted_at_idx" ON "hotel_contacts"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_room_categories_hotel_id_idx" ON "hotel_room_categories"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_room_categories_deleted_at_idx" ON "hotel_room_categories"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_venues_hotel_id_idx" ON "hotel_venues"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_venues_deleted_at_idx" ON "hotel_venues"("deleted_at");

-- AddForeignKey
ALTER TABLE "hotel_contacts" ADD CONSTRAINT "hotel_contacts_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_categories" ADD CONSTRAINT "hotel_room_categories_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_venues" ADD CONSTRAINT "hotel_venues_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
