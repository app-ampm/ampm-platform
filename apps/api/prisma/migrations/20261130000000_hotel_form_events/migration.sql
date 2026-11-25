-- The hotel form's request events (D-189 §6; docs/planning/hotel-information-form-plan.md §4.2 and §6.1,
-- Slice 7b): what a hotel person does through the identity step joins the request's history the Hotel
-- team reads, with actor kind hotel_person.
-- - code_requested: someone holding the link asked for a code, the first human step, so a link counts as
--   opened only then (mail scanners open links too); no person exists yet, so actor_person_id is null and
--   the detail names the challenge.
-- - person_verified: a correct code, from a new or a returning person (actor_person_id set).
-- - person_updated: a person changed their own name or designation; the detail names the fields only.
-- Expand only: three enum values, no row changes. ADD VALUE commits before any row uses the values.
-- Locks: ADD VALUE takes only the enum type's own lock, which no read or write of a row takes, so it touches
-- no table, reads no row and waits on no live change; only another ALTER TYPE of this enum could hold it,
-- and the wait for that is bounded as in 20261129000000_hotel_form_identity.

SET lock_timeout = '5s';

-- AlterEnum
ALTER TYPE "HotelInfoRequestEventType" ADD VALUE 'code_requested';
ALTER TYPE "HotelInfoRequestEventType" ADD VALUE 'person_verified';
ALTER TYPE "HotelInfoRequestEventType" ADD VALUE 'person_updated';
