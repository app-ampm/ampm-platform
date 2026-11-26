import { createHash, randomBytes, randomUUID } from "node:crypto";

import { canonicalJson } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { nextHotelInfoRequestReference } from "../src/modules/hotels/hotel-info-request-reference.js";
import { startApi } from "./start-api.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const at = new Date("2026-11-26T10:00:00.000Z");

/** The SHA-256 of a value's canonical JSON, as the API stores a content or answers hash. */
function hashOf(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

/**
 * The tables of migration 20261201000000_hotel_form_sections (D-190 §1) against the migrated test
 * database: a request's section drafts, its submitted revisions and its corrections with their keys and
 * checks, the two declarations' consent kinds under the widened CHECK, and the form's four event types.
 * Synthetic rows only (made-up names, reserved test mobiles); every row this file writes is removed after it.
 */
describe("The hotel form's sections: the data (e2e, D-190 §1)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let destinationId: string;
  let hotelId: string;
  let requestId: string;
  let personId: string;

  const section = (overrides: Partial<Prisma.HotelInfoRequestSectionUncheckedCreateInput> = {}) =>
    prisma.hotelInfoRequestSection.create({
      data: {
        requestId,
        sectionKey: "property",
        schemaVersion: 1,
        answers: { name: "Synthetic Lake Palace" },
        contentHash: hashOf({ name: "Synthetic Lake Palace" }),
        lastEditorPersonId: personId,
        lastEditedAt: at,
        ...overrides,
      },
    });

  const revision = (overrides: Partial<Prisma.HotelInfoRequestRevisionUncheckedCreateInput> = {}) =>
    prisma.hotelInfoRequestRevision.create({
      data: {
        requestId,
        revision: 1,
        answers: { property: { name: "Synthetic Lake Palace" } },
        answersHash: hashOf({ property: { name: "Synthetic Lake Palace" } }),
        submittedByPersonId: personId,
        submittedAt: at,
        ...overrides,
      },
    });

  const correction = (
    overrides: Partial<Prisma.HotelInfoRequestCorrectionUncheckedCreateInput> = {},
  ) =>
    prisma.hotelInfoRequestCorrection.create({
      data: { requestId, personId, message: "The lawn seats 900, not 600.", ...overrides },
    });

  const consent = (overrides: Partial<Prisma.HotelInfoRequestConsentUncheckedCreateInput>) =>
    prisma.hotelInfoRequestConsent.create({
      data: {
        personId,
        kind: "accuracy_attestation",
        textVersion: "hf-accuracy-test",
        granted: true,
        ...overrides,
      },
    });

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    const suffix = randomBytes(4).toString("hex");
    const destination = await prisma.destination.create({
      data: { name: "E2E Sections Coast", slug: `e2e-sections-coast-${suffix}`, country: "India" },
    });
    destinationId = destination.id;
    const hotel = await prisma.hotel.create({
      data: { destinationId, name: "E2E Sections Hotel", slug: `e2e-sections-hotel-${suffix}` },
    });
    hotelId = hotel.id;
    const request = await prisma.hotelInfoRequest.create({
      data: {
        reference: await nextHotelInfoRequestReference(prisma, at),
        kind: "onboarding",
        target: "existing",
        hotelId,
        expiresAt: new Date(at.getTime() + 30 * DAY_MS),
        tokenHash: hashOf(randomBytes(16).toString("hex")),
        linkIssuedAt: at,
      },
    });
    requestId = request.id;
    const person = await prisma.hotelInfoRequestPerson.create({
      data: {
        requestId,
        fullName: "Synthetic Person",
        designation: "General Manager",
        phone: "+919000000101",
        codeEnteredAt: at,
        codeDelivery: "screen",
      },
    });
    personId = person.id;
  });

  afterAll(async () => {
    await prisma.hotelInfoRequestSection.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequestRevision.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequestCorrection.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequestConsent.deleteMany({ where: { person: { requestId } } });
    await prisma.hotelInfoRequestEvent.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequestPerson.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequest.deleteMany({ where: { id: requestId } });
    await prisma.hotel.deleteMany({ where: { id: hotelId } });
    await prisma.destination.deleteMany({ where: { id: destinationId } });
    await app.close();
  });

  describe("sections", () => {
    it("start at version 1, not complete and not 'No changes', one row per request and section", async () => {
      const first = await section();
      expect(first).toMatchObject({ version: 1, isComplete: false, noChanges: false });
      await expect(section()).rejects.toThrow(
        /hotel_info_request_sections_request_id_section_key_key|Unique constraint/,
      );
      const rooms = await section({ sectionKey: "rooms", answers: {}, contentHash: hashOf({}) });
      expect(rooms.sectionKey).toBe("rooms");
    });

    it("refuse a version or schema version below 1", async () => {
      const contact = { sectionKey: "contact" as const };
      await expect(section({ ...contact, version: 0 })).rejects.toThrow(
        /hotel_info_request_sections_version_from_one/,
      );
      await expect(section({ ...contact, schemaVersion: 0 })).rejects.toThrow(
        /hotel_info_request_sections_version_from_one/,
      );
    });

    it("hold a SHA-256 in hex as the content hash, and one JSON object as the answers", async () => {
      const venues = { sectionKey: "venues" as const };
      for (const contentHash of ["A".repeat(64), "a".repeat(63), "sha256:abc"]) {
        await expect(section({ ...venues, contentHash }), contentHash).rejects.toThrow(
          /hotel_info_request_sections_content_hash_sha256/,
        );
      }
      for (const answers of [[], "text", 3]) {
        await expect(section({ ...venues, answers }), JSON.stringify(answers)).rejects.toThrow(
          /hotel_info_request_sections_answers_object/,
        );
      }
    });

    it("cannot store a lone surrogate, which is why the drafts refuse one on its field", async () => {
      await expect(
        section({ sectionKey: "booking_terms", answers: { notes: "Lawn \ud83d" } }),
      ).rejects.toThrow();
    });

    it("belong to a request and a person that exist", async () => {
      const key = { sectionKey: "food_beverage" as const };
      await expect(section({ ...key, requestId: randomUUID() })).rejects.toThrow(
        /hotel_info_request_sections_request_id_fkey/,
      );
      await expect(section({ ...key, lastEditorPersonId: randomUUID() })).rejects.toThrow(
        /hotel_info_request_sections_last_editor_person_id_fkey/,
      );
    });
  });

  describe("revisions", () => {
    it("count from 1, once per request, with the files an empty list until Slice 9", async () => {
      const first = await revision();
      expect(first.files).toEqual([]);
      await expect(revision()).rejects.toThrow(
        /hotel_info_request_revisions_request_id_revision_key|Unique constraint/,
      );
      await expect(revision({ revision: 0 })).rejects.toThrow(
        /hotel_info_request_revisions_revision_from_one/,
      );
      const second = await revision({ revision: 2 });
      expect(second.revision).toBe(2);
    });

    it("hold a SHA-256 in hex, the answers as one object and the files as a list", async () => {
      await expect(revision({ revision: 3, answersHash: "x" })).rejects.toThrow(
        /hotel_info_request_revisions_answers_hash_sha256/,
      );
      await expect(revision({ revision: 3, answers: [] })).rejects.toThrow(
        /hotel_info_request_revisions_answers_shape/,
      );
      await expect(revision({ revision: 3, files: {} })).rejects.toThrow(
        /hotel_info_request_revisions_answers_shape/,
      );
      await expect(revision({ revision: 3, submittedByPersonId: randomUUID() })).rejects.toThrow(
        /hotel_info_request_revisions_submitted_by_person_id_fkey/,
      );
    });
  });

  describe("corrections", () => {
    it("hold a message of up to 2,000 characters that says something", async () => {
      const kept = await correction({ message: "x".repeat(2_000) });
      expect(kept).toMatchObject({ handledAt: null, handledBy: null });
      await expect(correction({ message: "x".repeat(2_001) })).rejects.toThrow();
      for (const message of ["", "   ", "\n\t"]) {
        await expect(correction({ message }), JSON.stringify(message)).rejects.toThrow(
          /hotel_info_request_corrections_message_not_blank/,
        );
      }
    });

    it("are marked handled with the time and the member of staff together", async () => {
      const open = await correction();
      for (const handled of [{ handledAt: at }, { handledBy: randomUUID() }]) {
        await expect(
          prisma.hotelInfoRequestCorrection.update({ where: { id: open.id }, data: handled }),
          JSON.stringify(handled),
        ).rejects.toThrow(/hotel_info_request_corrections_handled_together/);
      }
      const handled = await prisma.hotelInfoRequestCorrection.update({
        where: { id: open.id },
        data: { handledAt: at, handledBy: randomUUID() },
      });
      expect(handled.handledAt).toEqual(at);
      await expect(correction({ personId: randomUUID() })).rejects.toThrow(
        /hotel_info_request_corrections_person_id_fkey/,
      );
    });
  });

  describe("consents", () => {
    const revisionHash = hashOf({ property: { name: "Synthetic Lake Palace" } });

    it("bind both declarations to a revision's hash, 7.5 holding its Yes or No", async () => {
      const accuracy = await consent({ revisionHash });
      expect(accuracy).toMatchObject({ kind: "accuracy_attestation", granted: true, revisionHash });
      const display = await consent({
        kind: "display_authorisation",
        textVersion: "hf-display-test",
        granted: false,
        revisionHash,
      });
      expect(display).toMatchObject({ kind: "display_authorisation", granted: false });
    });

    it("refuse a declaration without a revision hash, or with one that is not a SHA-256", async () => {
      for (const kind of ["accuracy_attestation", "display_authorisation"] as const) {
        for (const hash of [null, "abc", "A".repeat(64)]) {
          await expect(consent({ kind, revisionHash: hash }), `${kind} ${hash}`).rejects.toThrow(
            /hotel_info_request_consents_revision_hash_by_kind/,
          );
        }
      }
    });

    it("still record the privacy notice without a revision hash, and refuse one on it", async () => {
      const notice = { kind: "privacy_notice" as const, textVersion: "hf-notice-test" };
      expect((await consent(notice)).revisionHash).toBeNull();
      await expect(consent({ ...notice, revisionHash })).rejects.toThrow(
        /hotel_info_request_consents_revision_hash_by_kind/,
      );
    });

    it("keep one CHECK on the revision hash: the one this migration widened", async () => {
      const rows = await prisma.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'hotel_info_request_consents'::regclass AND contype = 'c'`;
      expect(rows.map((row) => row.conname)).toEqual([
        "hotel_info_request_consents_revision_hash_by_kind",
      ]);
    });
  });

  it("records the form's four events with a hotel person as their actor", async () => {
    const types = [
      "submitted",
      "correction_requested",
      "consent_withdrawn",
      "removal_requested",
    ] as const;
    for (const eventType of types) {
      const event = await prisma.hotelInfoRequestEvent.create({
        data: {
          requestId,
          eventType,
          actorKind: "hotel_person",
          actorPersonId: personId,
        },
      });
      expect(event.eventType).toBe(eventType);
    }
  });

  it("creates the keys and indexes D-190 names", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename IN
        ('hotel_info_request_sections', 'hotel_info_request_revisions', 'hotel_info_request_corrections')`;
    expect(rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "hotel_info_request_sections_request_id_section_key_key",
        "hotel_info_request_sections_last_editor_person_id_idx",
        "hotel_info_request_revisions_request_id_revision_key",
        "hotel_info_request_revisions_submitted_by_person_id_idx",
        "hotel_info_request_corrections_request_id_created_at_idx",
        "hotel_info_request_corrections_person_id_idx",
        "hotel_info_request_corrections_handled_by_idx",
      ]),
    );
  });
});
