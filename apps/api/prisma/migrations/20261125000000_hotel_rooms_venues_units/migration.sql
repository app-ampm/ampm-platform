-- Rooms, venues and units (D-178; docs/planning/hotel-information-form-plan.md §6.2, Slice 3) and the
-- import's stored preview (D-181; §4.8): a room's unit type, view, bed configuration and size in sq ft;
-- a venue's setting (is_indoor kept in step by the service), area in sq ft, dimensions in metres,
-- ceiling height, pre-function area, other layouts and capacity notes; five more venue types; the rooms
-- and venues import kinds; import_jobs.plan_json (RESTRICTED-NOTES, set by the System). Additive and
-- nullable (expand-and-contract): `setting` stays nullable with no CHECK against is_indoor, because the
-- previous image and direct inserts write is_indoor alone. None of the values added by ALTER TYPE (the
-- five venue types, hotel_rooms, hotel_venues) is used in this file: a value added by ALTER TYPE cannot
-- be used before its transaction commits. HotelVenueSetting is created here, so its values can be.
-- The data steps after the generated body write no updated_at, so no row looks edited by a person.
-- Production held no hotels, rooms, venues, contacts or import jobs when this was written (24 November
-- 2026), so those steps are defensive.

-- CreateEnum
CREATE TYPE "HotelRoomUnitType" AS ENUM ('room', 'suite', 'villa', 'cottage', 'tent', 'tent_suite', 'apartment', 'other');

-- CreateEnum
CREATE TYPE "HotelVenueSetting" AS ENUM ('indoor', 'outdoor', 'semi_open');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImportType" ADD VALUE 'hotel_rooms';
ALTER TYPE "ImportType" ADD VALUE 'hotel_venues';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HotelVenueType" ADD VALUE 'terrace';
ALTER TYPE "HotelVenueType" ADD VALUE 'garden';
ALTER TYPE "HotelVenueType" ADD VALUE 'amphitheatre';
ALTER TYPE "HotelVenueType" ADD VALUE 'meeting_room';
ALTER TYPE "HotelVenueType" ADD VALUE 'lounge';

-- AlterTable
ALTER TABLE "import_jobs" ADD COLUMN     "plan_json" JSONB;

-- AlterTable
ALTER TABLE "hotel_room_categories" ADD COLUMN     "bed_configuration" VARCHAR(255),
ADD COLUMN     "size_sqft" INTEGER,
ADD COLUMN     "unit_type" "HotelRoomUnitType",
ADD COLUMN     "view_label" VARCHAR(255);

-- AlterTable
ALTER TABLE "hotel_venues" ADD COLUMN     "area_sqft" INTEGER,
ADD COLUMN     "capacity_notes" TEXT,
ADD COLUMN     "ceiling_height_m" DECIMAL(6,2),
ADD COLUMN     "length_m" DECIMAL(6,2),
ADD COLUMN     "other_layouts_json" JSONB,
ADD COLUMN     "prefunction_area_sqft" INTEGER,
ADD COLUMN     "prefunction_area_sqm" INTEGER,
ADD COLUMN     "setting" "HotelVenueSetting",
ADD COLUMN     "width_m" DECIMAL(6,2);

-- Every venue saved so far gets its setting from is_indoor: indoor when true, outdoor when false.
UPDATE "hotel_venues"
SET "setting" = CASE WHEN "is_indoor" THEN 'indoor'::"HotelVenueSetting" ELSE 'outdoor'::"HotelVenueSetting" END
WHERE "setting" IS NULL;

-- A room's maximum occupancy is 1 or more when stated (D-178): a stored 0 or less meant "not stated",
-- so it becomes NULL before the CHECK holds every row to the rule. Postgres CHECK constraints are not
-- expressible in schema.prisma, so `prisma migrate dev` reports this as drift; CI/test/prod use
-- `prisma migrate deploy`, which applies and enforces it.
UPDATE "hotel_room_categories" SET "max_occupancy" = NULL WHERE "max_occupancy" < 1;

ALTER TABLE "hotel_room_categories"
  ADD CONSTRAINT "hotel_room_categories_max_occupancy_at_least_one"
  CHECK ("max_occupancy" IS NULL OR "max_occupancy" >= 1);

-- One live primary contact per hotel (D-178). A hotel that has several keeps the most recently updated
-- one (the newest id breaking a tie) and the others stop being primary.
UPDATE "hotel_contacts" AS "contact"
SET "is_primary" = false
FROM (
  SELECT "id",
         row_number() OVER (PARTITION BY "hotel_id" ORDER BY "updated_at" DESC, "id" DESC) AS "newest_first"
  FROM "hotel_contacts"
  WHERE "is_primary" AND "deleted_at" IS NULL
) AS "ranked"
WHERE "contact"."id" = "ranked"."id" AND "ranked"."newest_first" > 1;

-- The service demotes the current primary in the same transaction as a write that names a new one, and
-- pre-checks for a friendly error, but only this index is race-safe: two concurrent writes cannot leave a
-- hotel with two live primaries. Removed (soft-deleted) contacts are excluded, so a primary frees up when
-- its contact is removed. Partial indexes are not expressible in schema.prisma, hence raw SQL;
-- `prisma migrate deploy` applies it.
CREATE UNIQUE INDEX "hotel_contacts_hotel_live_primary_key"
  ON "hotel_contacts" ("hotel_id")
  WHERE "is_primary" AND "deleted_at" IS NULL;

-- A hotel whose total event space was stated only in sq ft gets the m² the converter derives (core
-- `sqmFromSqft`): round(sq ft × 0.09290304) as the exact fraction 145161 / 1562500, in numeric so the
-- product cannot overflow an integer and the half rounds away from zero as the converter's does. An m²
-- already stored is never overwritten.
UPDATE "hotels"
SET "total_event_space_sqm" = round("total_event_space_sqft"::numeric * 145161 / 1562500)
WHERE "total_event_space_sqm" IS NULL AND "total_event_space_sqft" IS NOT NULL;
