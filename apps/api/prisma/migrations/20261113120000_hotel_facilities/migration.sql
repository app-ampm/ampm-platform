-- Curated hotel-level amenity labels (B14, option A). Mirrors
-- hotel_room_categories.facilities_json and hotel_venues.facilities_json: a
-- nullable JSONB array of strings, validated by the core `facilities` schema at
-- the edge. Additive and nullable (expand-and-contract) — no backfill, because
-- a null curated list means "derive it from the room/venue union" (option B).
ALTER TABLE "hotels" ADD COLUMN     "facilities_json" JSONB;
