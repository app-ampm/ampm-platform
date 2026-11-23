-- The hotel catalogue gains homes for every hotel information form answer and recurring
-- fact-sheet fact (D-178; docs/planning/hotel-information-form-plan.md §6.2, Slice 2): location
-- and access, total event space, booking terms (INTERNAL, decision 12) and food and beverage,
-- plus the `policies` verification group for the booking terms. Additive and nullable
-- (expand-and-contract), no backfill. `policies` is not used in this file: a value added by
-- ALTER TYPE cannot be used before its transaction commits.

-- CreateEnum
CREATE TYPE "HotelWeddingBuyoutPolicy" AS ENUM ('not_required', 'required', 'depends');

-- CreateEnum
CREATE TYPE "HotelParallelFunctions" AS ENUM ('allowed', 'not_allowed', 'depends');

-- AlterEnum
ALTER TYPE "HotelVerificationFieldGroup" ADD VALUE 'policies';

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "access_notes" TEXT,
ADD COLUMN     "airport_distance_km" DECIMAL(4,1),
ADD COLUMN     "airport_drive_minutes" INTEGER,
ADD COLUMN     "airport_name" VARCHAR(255),
ADD COLUMN     "booking_notes" TEXT,
ADD COLUMN     "city" VARCHAR(255),
ADD COLUMN     "city_centre_distance_km" DECIMAL(4,1),
ADD COLUMN     "city_centre_drive_minutes" INTEGER,
ADD COLUMN     "cuisines_json" JSONB,
ADD COLUMN     "has_separate_veg_kitchen" BOOLEAN,
ADD COLUMN     "is_pure_vegetarian" BOOLEAN,
ADD COLUMN     "locality" VARCHAR(255),
ADD COLUMN     "maps_url" VARCHAR(2048),
ADD COLUMN     "min_nights" INTEGER,
ADD COLUMN     "min_rooms_without_buyout" INTEGER,
ADD COLUMN     "name_aliases_json" JSONB,
ADD COLUMN     "parallel_functions" "HotelParallelFunctions",
ADD COLUMN     "parent_group" VARCHAR(255),
ADD COLUMN     "postal_code" VARCHAR(16),
ADD COLUMN     "railway_distance_km" DECIMAL(4,1),
ADD COLUMN     "railway_drive_minutes" INTEGER,
ADD COLUMN     "railway_station_name" VARCHAR(255),
ADD COLUMN     "serves_alcohol" BOOLEAN,
ADD COLUMN     "state" VARCHAR(255),
ADD COLUMN     "total_event_space_sqft" INTEGER,
ADD COLUMN     "total_event_space_sqm" INTEGER,
ADD COLUMN     "wedding_buyout_policy" "HotelWeddingBuyoutPolicy";
