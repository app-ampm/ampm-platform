-- A new hotel's website is optional when AMPM invites it (D-192): a new-hotel request must name the
-- proposed hotel and its destination, and its website and normalised key are kept only when staff give
-- one. The partial unique index hotel_info_requests_web_address_live_key stays as it is: PostgreSQL never
-- finds two null keys equal, so a request with no website holds no address, and one with a website still
-- holds it alone while it is live.
-- Expand only: one CHECK widened, no row changed. The new CHECK holds every row the old one did, so the
-- API still deployed (which always writes a key) keeps writing rows it allows; the API that writes a
-- request with no key goes out after this file has run.
-- Locks, while the previous API still serves: Prisma 7 applies this file one statement at a time, each
-- committing on its own, and the SET below holds for every statement after it, so no statement waits more
-- than 5 seconds for its locks. The new CHECK is added before the old one is dropped, so the table is
-- never without one; the ADD reads the small requests table once to check it, and each statement holds
-- the table for an instant. Postgres CHECK constraints are not expressible in schema.prisma, hence raw SQL
-- (as in 20261128000000_hotel_info_requests).

SET lock_timeout = '5s';

ALTER TABLE "hotel_info_requests"
  ADD CONSTRAINT "hotel_info_requests_new_has_name_and_destination"
  CHECK ("target" <> 'new' OR ("proposed_name" IS NOT NULL AND "proposed_destination_id" IS NOT NULL));

ALTER TABLE "hotel_info_requests"
  DROP CONSTRAINT "hotel_info_requests_new_has_proposal";
