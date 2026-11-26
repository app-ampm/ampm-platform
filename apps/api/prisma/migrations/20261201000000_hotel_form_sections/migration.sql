-- The hotel information form's sections (D-190 §1, docs/planning/hotel-information-form-plan.md §4.4 and
-- §6.1, Slice 8a): the shared draft a request's people fill in (one row per section, made at its first
-- save), the immutable snapshot each submit takes, and the corrections a person asks for after submitting.
-- The two declarations of submit join the consent kinds, bound to the submitted revision's hash, and the
-- form's four events join the request's history. A section's autosave writes no event.
-- Expand only: a new type, six enum values, three new tables and their keys, and the consents' CHECK
-- widened. No row changes, and the previous API still writes what the new CHECK allows (a privacy
-- notice's consent without a revision hash). Retention class hotel_intake, following the request (D-180).
-- Locks, while the previous API still serves: Prisma 7 applies this file one statement at a time, each
-- committing on its own, and the SET below holds for every statement after it, so no statement waits more
-- than 5 seconds for its locks. ADD VALUE takes only its enum type's lock. The new tables hold no row, so
-- their keys and CHECKs read nothing, and each foreign key holds its parent table (a request, or a person)
-- in SHARE ROW EXCLUSIVE for an instant. The consents' new CHECK is added before the old one is dropped,
-- so the table is never without one, each statement holding the small consents table for an instant.
-- The new CHECK names only privacy_notice, never a value this file adds, so the file also runs by hand as
-- one transaction (PostgreSQL refuses a new enum value before its ALTER TYPE commits).

SET lock_timeout = '5s';

-- CreateEnum
CREATE TYPE "HotelFormSectionKey" AS ENUM ('property', 'contact', 'rooms', 'venues', 'booking_terms', 'food_beverage', 'fact_sheet_media');

-- AlterEnum
ALTER TYPE "HotelInfoRequestConsentKind" ADD VALUE 'accuracy_attestation';
ALTER TYPE "HotelInfoRequestConsentKind" ADD VALUE 'display_authorisation';

-- AlterEnum
ALTER TYPE "HotelInfoRequestEventType" ADD VALUE 'submitted';
ALTER TYPE "HotelInfoRequestEventType" ADD VALUE 'correction_requested';
ALTER TYPE "HotelInfoRequestEventType" ADD VALUE 'consent_withdrawn';
ALTER TYPE "HotelInfoRequestEventType" ADD VALUE 'removal_requested';

-- CreateTable
CREATE TABLE "hotel_info_request_sections" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "section_key" "HotelFormSectionKey" NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "answers_json" JSONB NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "no_changes" BOOLEAN NOT NULL DEFAULT false,
    "last_editor_person_id" UUID NOT NULL,
    "last_edited_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_request_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_info_request_revisions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "answers_json" JSONB NOT NULL,
    "answers_hash" VARCHAR(64) NOT NULL,
    "files_json" JSONB NOT NULL DEFAULT '[]',
    "submitted_by_person_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_request_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_info_request_corrections" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "handled_at" TIMESTAMPTZ(6),
    "handled_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_info_request_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_info_request_sections_last_editor_person_id_idx" ON "hotel_info_request_sections"("last_editor_person_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_sections_deleted_at_idx" ON "hotel_info_request_sections"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_info_request_sections_request_id_section_key_key" ON "hotel_info_request_sections"("request_id", "section_key");

-- CreateIndex
CREATE INDEX "hotel_info_request_revisions_submitted_by_person_id_idx" ON "hotel_info_request_revisions"("submitted_by_person_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_revisions_deleted_at_idx" ON "hotel_info_request_revisions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_info_request_revisions_request_id_revision_key" ON "hotel_info_request_revisions"("request_id", "revision");

-- CreateIndex
CREATE INDEX "hotel_info_request_corrections_request_id_created_at_idx" ON "hotel_info_request_corrections"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "hotel_info_request_corrections_person_id_idx" ON "hotel_info_request_corrections"("person_id");

-- CreateIndex
CREATE INDEX "hotel_info_request_corrections_handled_by_idx" ON "hotel_info_request_corrections"("handled_by");

-- CreateIndex
CREATE INDEX "hotel_info_request_corrections_deleted_at_idx" ON "hotel_info_request_corrections"("deleted_at");


-- The rules of D-190 §1 that the schema cannot express. Postgres CHECK constraints are not expressible in
-- schema.prisma, so `prisma migrate dev` reports them as drift. CI, the tests and production use
-- `prisma migrate deploy`, which applies and enforces them.

-- A section's version starts at 1 and every change adds 1, its schema version is core's (from 1), its
-- content hash is the SHA-256 of its canonical JSON in hex, and its answers are one JSON object.
ALTER TABLE "hotel_info_request_sections"
  ADD CONSTRAINT "hotel_info_request_sections_version_from_one"
  CHECK ("version" >= 1 AND "schema_version" >= 1);

ALTER TABLE "hotel_info_request_sections"
  ADD CONSTRAINT "hotel_info_request_sections_content_hash_sha256"
  CHECK ("content_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "hotel_info_request_sections"
  ADD CONSTRAINT "hotel_info_request_sections_answers_object"
  CHECK (jsonb_typeof("answers_json") = 'object');

-- A revision counts from 1 per request (the unique key above), its hash is the SHA-256 of its canonical
-- JSON in hex, its answers are one object holding every section, and its files a list (empty until Slice 9).
ALTER TABLE "hotel_info_request_revisions"
  ADD CONSTRAINT "hotel_info_request_revisions_revision_from_one"
  CHECK ("revision" >= 1);

ALTER TABLE "hotel_info_request_revisions"
  ADD CONSTRAINT "hotel_info_request_revisions_answers_hash_sha256"
  CHECK ("answers_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "hotel_info_request_revisions"
  ADD CONSTRAINT "hotel_info_request_revisions_answers_shape"
  CHECK (jsonb_typeof("answers_json") = 'object' AND jsonb_typeof("files_json") = 'array');

-- A correction says something, and staff mark it handled with their name and the time together (8b).
ALTER TABLE "hotel_info_request_corrections"
  ADD CONSTRAINT "hotel_info_request_corrections_message_not_blank"
  CHECK ("message" ~ '[^[:space:]]');

ALTER TABLE "hotel_info_request_corrections"
  ADD CONSTRAINT "hotel_info_request_corrections_handled_together"
  CHECK (("handled_at" IS NULL) = ("handled_by" IS NULL));

-- AddForeignKey
ALTER TABLE "hotel_info_request_sections" ADD CONSTRAINT "hotel_info_request_sections_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "hotel_info_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_sections" ADD CONSTRAINT "hotel_info_request_sections_last_editor_person_id_fkey" FOREIGN KEY ("last_editor_person_id") REFERENCES "hotel_info_request_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_revisions" ADD CONSTRAINT "hotel_info_request_revisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "hotel_info_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_revisions" ADD CONSTRAINT "hotel_info_request_revisions_submitted_by_person_id_fkey" FOREIGN KEY ("submitted_by_person_id") REFERENCES "hotel_info_request_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_corrections" ADD CONSTRAINT "hotel_info_request_corrections_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "hotel_info_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_info_request_corrections" ADD CONSTRAINT "hotel_info_request_corrections_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hotel_info_request_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Last, the consents (D-190 §1). The two declarations carry the SHA-256 of the revision they bind to and
-- the privacy notice carries none. The new CHECK holds every row the old one did, so it goes in first and
-- the old one, which it replaces, comes out after it. It names only privacy_notice, as said above. The
-- IS NOT NULL is needed: a CHECK passes when its expression is null, as a null matched against a pattern is.
ALTER TABLE "hotel_info_request_consents"
  ADD CONSTRAINT "hotel_info_request_consents_revision_hash_by_kind"
  CHECK (("kind" = 'privacy_notice' AND "revision_hash" IS NULL)
    OR ("kind" <> 'privacy_notice' AND "revision_hash" IS NOT NULL
      AND "revision_hash" ~ '^[0-9a-f]{64}$'));

ALTER TABLE "hotel_info_request_consents"
  DROP CONSTRAINT "hotel_info_request_consents_notice_has_no_revision";
