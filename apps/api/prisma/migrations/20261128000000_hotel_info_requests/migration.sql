-- Hotel information requests (D-188 §1 and §5; docs/planning/hotel-information-form-plan.md §4.2, §4.9 and
-- §6.1, Slice 7a): the requests and their events, the reference sequence, and external notification
-- recipients. A request is one round of the hotel information form for a hotel or a proposed new hotel;
-- its link's secret is stored only as a SHA-256 hash (token_hash), and its recipient as AMPM entered them.
-- notifications gains recipient_type `external` and two nullable columns: recipient_address (an external
-- recipient's address, RESTRICTED-CONTACT) and reply_to, both cleared with `data` when a row leaves
-- `queued`. Expand only: new types, tables, a sequence and nullable columns; no existing row changes. The
-- value added by ALTER TYPE is not used in this file: a value added by ALTER TYPE cannot be used before its
-- transaction commits. The request enums are created here, so the checks and indexes below can use them.
-- Production held no hotel information requests when this was written (24 November 2026). Rolling back
-- past it needs one step for queued external notifications (docs/data-model.md §5).

-- CreateEnum
CREATE TYPE "HotelInfoRequestKind" AS ENUM ('onboarding', 'refresh');

-- CreateEnum
CREATE TYPE "HotelInfoRequestTarget" AS ENUM ('existing', 'new');

-- CreateEnum
CREATE TYPE "HotelInfoRequestStatus" AS ENUM ('open', 'submitted', 'in_review', 'changes_requested', 'merged', 'rejected', 'revoked');

-- CreateEnum
CREATE TYPE "HotelInfoRequestPrefillMode" AS ENUM ('none');

-- CreateEnum
CREATE TYPE "HotelInfoRequestEventType" AS ENUM ('created', 'link_reissued', 'link_emailed', 'share_recorded', 'updated', 'expiry_extended', 'revoked');

-- CreateEnum
CREATE TYPE "HotelInfoRequestActorKind" AS ENUM ('staff', 'hotel_person', 'system');

-- AlterEnum
ALTER TYPE "RecipientType" ADD VALUE 'external';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "recipient_address" VARCHAR(255),
ADD COLUMN     "reply_to" VARCHAR(255);

-- CreateTable
CREATE TABLE "hotel_info_requests" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "kind" "HotelInfoRequestKind" NOT NULL,
    "target" "HotelInfoRequestTarget" NOT NULL,
    "hotel_id" UUID,
    "proposed_name" VARCHAR(255),
    "proposed_destination_id" UUID,
    "proposed_web_address" VARCHAR(255),
    "proposed_web_address_key" VARCHAR(2048),
    "official_website" VARCHAR(255),
    "switchboard_phone" VARCHAR(32),
    "switchboard_source" VARCHAR(255),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "status" "HotelInfoRequestStatus" NOT NULL DEFAULT 'open',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "status_only_until" TIMESTAMPTZ(6),
    "display_label" VARCHAR(255),
    "staff_note" TEXT,
    "token_hash" VARCHAR(128) NOT NULL,
    "token_generation" INTEGER NOT NULL DEFAULT 1,
    "link_issued_at" TIMESTAMPTZ(6) NOT NULL,
    "link_emailed_at" TIMESTAMPTZ(6),
    "recipient_name" VARCHAR(255),
    "recipient_email" VARCHAR(255),
    "prefill_mode" "HotelInfoRequestPrefillMode" NOT NULL DEFAULT 'none',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "submitted_by_person_id" UUID,
    "reviewer_user_id" UUID,
    "review_started_at" TIMESTAMPTZ(6),
    "changes_requested_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "reject_reason" TEXT,
    "merged_at" TIMESTAMPTZ(6),
    "merge_plan_hash" VARCHAR(64),
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,
    "retention_class" VARCHAR(32) NOT NULL DEFAULT 'hotel_intake',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_info_request_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "event_type" "HotelInfoRequestEventType" NOT NULL,
    "actor_kind" "HotelInfoRequestActorKind" NOT NULL,
    "actor_user_id" UUID,
    "actor_person_id" UUID,
    "detail_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_info_requests_reference_key" ON "hotel_info_requests"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_info_requests_token_hash_key" ON "hotel_info_requests"("token_hash");

-- CreateIndex
CREATE INDEX "hotel_info_requests_hotel_id_idx" ON "hotel_info_requests"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_info_requests_proposed_destination_id_idx" ON "hotel_info_requests"("proposed_destination_id");

-- CreateIndex
CREATE INDEX "hotel_info_requests_status_expires_at_idx" ON "hotel_info_requests"("status", "expires_at");

-- CreateIndex
CREATE INDEX "hotel_info_requests_status_submitted_at_idx" ON "hotel_info_requests"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "hotel_info_requests_reviewer_user_id_idx" ON "hotel_info_requests"("reviewer_user_id");

-- CreateIndex
CREATE INDEX "hotel_info_requests_submitted_by_person_id_idx" ON "hotel_info_requests"("submitted_by_person_id");

-- CreateIndex
CREATE INDEX "hotel_info_requests_deleted_at_idx" ON "hotel_info_requests"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_info_request_events_request_id_occurred_at_idx" ON "hotel_info_request_events"("request_id", "occurred_at");

-- CreateIndex
CREATE INDEX "hotel_info_request_events_actor_user_id_idx" ON "hotel_info_request_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_events_actor_person_id_idx" ON "hotel_info_request_events"("actor_person_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_events_deleted_at_idx" ON "hotel_info_request_events"("deleted_at");

-- AddForeignKey
ALTER TABLE "hotel_info_requests" ADD CONSTRAINT "hotel_info_requests_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_requests" ADD CONSTRAINT "hotel_info_requests_proposed_destination_id_fkey" FOREIGN KEY ("proposed_destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_events" ADD CONSTRAINT "hotel_info_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "hotel_info_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The reference's number (D-188 §1): HIR-<creation year, UTC>-<n>, written with four digits at least by
-- the API (nextHotelInfoRequestReference). One sequence that never resets: the year is only read, so no
-- scheduled reset is needed and two years never share a number. Sequences are not expressible in
-- schema.prisma, hence raw SQL.
CREATE SEQUENCE "hotel_info_request_ref_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;

-- An existing-hotel request names its hotel; a new-hotel request names the proposed hotel's name,
-- destination and normalised web address (core normaliseWebAddress), which the merge needs and the live
-- index below keys on. A new hotel's request gets its hotel_id at the merge. Postgres CHECK constraints are
-- not expressible in schema.prisma, so `prisma migrate dev` reports them as drift; CI, the tests and
-- production use `prisma migrate deploy`, which applies and enforces them.
ALTER TABLE "hotel_info_requests"
  ADD CONSTRAINT "hotel_info_requests_existing_has_hotel"
  CHECK ("target" <> 'existing' OR "hotel_id" IS NOT NULL);

ALTER TABLE "hotel_info_requests"
  ADD CONSTRAINT "hotel_info_requests_new_has_proposal"
  CHECK ("target" <> 'new' OR ("proposed_name" IS NOT NULL AND "proposed_destination_id" IS NOT NULL
    AND "proposed_web_address_key" IS NOT NULL));

-- One live request per hotel, and one live new-hotel request per normalised web address (D-188 §1). Live
-- is open, submitted, in_review or changes_requested; a soft-deleted request frees its hotel and address.
-- The service checks first for a friendly 409, but only these indexes are race-safe. Partial indexes are
-- not expressible in schema.prisma, hence raw SQL.
CREATE UNIQUE INDEX "hotel_info_requests_hotel_live_key"
  ON "hotel_info_requests" ("hotel_id")
  WHERE "status" IN ('open', 'submitted', 'in_review', 'changes_requested') AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "hotel_info_requests_web_address_live_key"
  ON "hotel_info_requests" ("proposed_web_address_key")
  WHERE "target" = 'new' AND "status" IN ('open', 'submitted', 'in_review', 'changes_requested')
    AND "deleted_at" IS NULL;
