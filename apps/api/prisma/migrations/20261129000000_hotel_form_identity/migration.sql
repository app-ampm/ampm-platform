-- The hotel information form's identity step (D-189 §1; docs/planning/hotel-information-form-plan.md §4.3,
-- §6.1 and §9, Slice 7b): the people of a request, their code challenges (each carrying the form session it
-- opens) and their consents, and the audit's actor_ref for a hotel-form contributor (D-180, D-189 §6).
-- A person is never a users row: a row exists only after a correct code. A challenge holds its claimant's
-- details only until the code is entered or it is retired, and its code only as an HMAC; a session only as
-- the SHA-256 of its token. Retention class hotel_intake, following the request (D-180).
-- Expand only: new types, three new tables, a nullable column on audit_events, and two foreign keys on
-- columns 7a left without one (hotel_info_requests.submitted_by_person_id and
-- hotel_info_request_events.actor_person_id, both null in every row so far). audit_events is partitioned by
-- month: ADD COLUMN on the parent reaches every partition, DEFAULT included, and a partition created later
-- (the maintenance job's CREATE TABLE ... PARTITION OF) inherits the column and the CHECK below. Adding the
-- column changes no row; the CHECK reads every audit row once, all of them null in the new column.

-- CreateEnum
CREATE TYPE "HotelFormCodeDelivery" AS ENUM ('sms', 'screen');

-- CreateEnum
CREATE TYPE "HotelInfoRequestConsentKind" AS ENUM ('privacy_notice');

-- CreateEnum
CREATE TYPE "HotelInfoRequestWithdrawalSource" AS ENUM ('contributor', 'staff');

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "actor_ref" TEXT;

-- CreateTable
CREATE TABLE "hotel_info_request_people" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "designation" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "code_entered_at" TIMESTAMPTZ(6) NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(6),
    "code_delivery" "HotelFormCodeDelivery" NOT NULL,
    "removed_at" TIMESTAMPTZ(6),
    "removed_by" UUID,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_request_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_info_request_challenges" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "link_generation" INTEGER NOT NULL,
    "claimed_full_name" VARCHAR(255),
    "claimed_designation" VARCHAR(255),
    "claimed_phone" VARCHAR(32),
    "claimed_notice_version" VARCHAR(64),
    "delivery" "HotelFormCodeDelivery" NOT NULL,
    "destination_hash" VARCHAR(64) NOT NULL,
    "code_hmac" VARCHAR(64) NOT NULL,
    "code_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ(6),
    "retired_at" TIMESTAMPTZ(6),
    "person_id" UUID,
    "session_token_hash" VARCHAR(64),
    "session_started_at" TIMESTAMPTZ(6),
    "session_last_seen_at" TIMESTAMPTZ(6),
    "session_ended_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_request_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_info_request_consents" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "kind" "HotelInfoRequestConsentKind" NOT NULL,
    "text_version" VARCHAR(64) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "revision_hash" VARCHAR(64),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(64),
    "withdrawn_at" TIMESTAMPTZ(6),
    "withdrawal_source" "HotelInfoRequestWithdrawalSource",
    "withdrawn_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_request_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_info_request_people_request_id_idx" ON "hotel_info_request_people"("request_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_people_removed_by_idx" ON "hotel_info_request_people"("removed_by");

-- CreateIndex
CREATE INDEX "hotel_info_request_people_deleted_at_idx" ON "hotel_info_request_people"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_info_request_challenges_session_token_hash_key" ON "hotel_info_request_challenges"("session_token_hash");

-- CreateIndex
CREATE INDEX "hotel_info_request_challenges_request_id_destination_hash_c_idx" ON "hotel_info_request_challenges"("request_id", "destination_hash", "created_at");

-- CreateIndex
CREATE INDEX "hotel_info_request_challenges_person_id_idx" ON "hotel_info_request_challenges"("person_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_challenges_deleted_at_idx" ON "hotel_info_request_challenges"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_info_request_consents_person_id_kind_idx" ON "hotel_info_request_consents"("person_id", "kind");

-- CreateIndex
CREATE INDEX "hotel_info_request_consents_withdrawn_by_user_id_idx" ON "hotel_info_request_consents"("withdrawn_by_user_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_consents_deleted_at_idx" ON "hotel_info_request_consents"("deleted_at");

-- AddForeignKey
ALTER TABLE "hotel_info_requests" ADD CONSTRAINT "hotel_info_requests_submitted_by_person_id_fkey" FOREIGN KEY ("submitted_by_person_id") REFERENCES "hotel_info_request_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_events" ADD CONSTRAINT "hotel_info_request_events_actor_person_id_fkey" FOREIGN KEY ("actor_person_id") REFERENCES "hotel_info_request_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_people" ADD CONSTRAINT "hotel_info_request_people_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "hotel_info_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_challenges" ADD CONSTRAINT "hotel_info_request_challenges_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "hotel_info_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_challenges" ADD CONSTRAINT "hotel_info_request_challenges_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hotel_info_request_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_consents" ADD CONSTRAINT "hotel_info_request_consents_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hotel_info_request_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The rules of D-189 §1 that the schema cannot express. Postgres CHECK constraints and partial indexes are not
-- expressible in schema.prisma, so `prisma migrate dev` reports them as drift; CI, the tests and production
-- use `prisma migrate deploy`, which applies and enforces them.

-- One person per request and phone while they are neither removed nor deleted: a returning person is found,
-- not created twice, and a removed person's place is freed. Only this index is race-safe.
CREATE UNIQUE INDEX "hotel_info_request_people_request_phone_live_key"
  ON "hotel_info_request_people" ("request_id", "phone")
  WHERE "removed_at" IS NULL AND "deleted_at" IS NULL;

-- Phones in E.164: a plus, then 8 to 15 digits, the first not a zero.
ALTER TABLE "hotel_info_request_people"
  ADD CONSTRAINT "hotel_info_request_people_phone_e164"
  CHECK ("phone" ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE "hotel_info_request_challenges"
  ADD CONSTRAINT "hotel_info_request_challenges_claimed_phone_e164"
  CHECK ("claimed_phone" IS NULL OR "claimed_phone" ~ '^\+[1-9][0-9]{7,14}$');

-- Each code allows 5 tries, reserved atomically by an update that increments while under 5.
ALTER TABLE "hotel_info_request_challenges"
  ADD CONSTRAINT "hotel_info_request_challenges_attempts_range"
  CHECK ("attempts" BETWEEN 0 AND 5);

-- The claim (name, designation, mobile, notice version) is cleared once the code is entered or the
-- challenge is retired, so a stranger's details never outlive their challenge.
ALTER TABLE "hotel_info_request_challenges"
  ADD CONSTRAINT "hotel_info_request_challenges_claim_cleared"
  CHECK (("used_at" IS NULL AND "retired_at" IS NULL)
    OR ("claimed_full_name" IS NULL AND "claimed_designation" IS NULL AND "claimed_phone" IS NULL
      AND "claimed_notice_version" IS NULL));

-- A person is set only when the code is entered, and a session only on a challenge that verified a person.
ALTER TABLE "hotel_info_request_challenges"
  ADD CONSTRAINT "hotel_info_request_challenges_person_on_use"
  CHECK ("person_id" IS NULL OR "used_at" IS NOT NULL);

ALTER TABLE "hotel_info_request_challenges"
  ADD CONSTRAINT "hotel_info_request_challenges_session_on_verified"
  CHECK ("session_token_hash" IS NULL OR ("person_id" IS NOT NULL AND "session_started_at" IS NOT NULL));

-- The privacy notice's consent binds to no revision; only the submit declarations of a later slice do.
ALTER TABLE "hotel_info_request_consents"
  ADD CONSTRAINT "hotel_info_request_consents_notice_has_no_revision"
  CHECK ("kind" <> 'privacy_notice' OR "revision_hash" IS NULL);

-- actor_ref names a hotel-form contributor (guest_token) and is null for staff and the System. A CHECK on
-- the partitioned parent holds on every partition, and each partition created later inherits it.
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_ref_guest_only"
  CHECK ("actor_ref" IS NULL OR "actor_type" = 'guest_token');
