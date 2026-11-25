import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { nextHotelInfoRequestReference } from "../src/modules/hotels/hotel-info-request-reference.js";
import { startApi } from "./start-api.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const at = new Date("2026-11-25T10:00:00.000Z");
/** Reserved fictitious mobiles (synthetic data only). */
const MOBILE = "+919000000001";
const OTHER_MOBILE = "+919000000002";

/** A 64-character hex value, as the HMACs and hashes are stored. */
function hex(): string {
  return createHash("sha256").update(randomBytes(16)).digest("hex");
}

/**
 * The tables of migration 20261129000000_hotel_form_identity (D-189 §1) against the migrated test
 * database: people, code challenges and consents with their indexes and checks, and the foreign keys 7a's
 * person columns gain (audit_events.actor_ref is audit-actor-ref.e2e-spec.ts). Synthetic rows only; every
 * row this file writes is removed after it.
 */
describe("The hotel form's identity step: the data (e2e, D-189 §1)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let destinationId: string;
  let hotelId: string;
  let requestId: string;

  const person = (overrides: Partial<Prisma.HotelInfoRequestPersonUncheckedCreateInput> = {}) =>
    prisma.hotelInfoRequestPerson.create({
      data: {
        requestId,
        fullName: "Synthetic Person",
        designation: "General Manager",
        phone: MOBILE,
        codeEnteredAt: at,
        codeDelivery: "screen",
        ...overrides,
      },
    });

  const challenge = (
    overrides: Partial<Prisma.HotelInfoRequestChallengeUncheckedCreateInput> = {},
  ) =>
    prisma.hotelInfoRequestChallenge.create({
      data: {
        requestId,
        linkGeneration: 1,
        claimedFullName: "Synthetic Claimant",
        claimedDesignation: "Sales Manager",
        claimedPhone: MOBILE,
        claimedNoticeVersion: "hf-notice-test",
        delivery: "screen",
        destinationHash: hex(),
        codeHmac: hex(),
        codeExpiresAt: new Date(at.getTime() + 5 * 60 * 1000),
        ...overrides,
      },
    });

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    const suffix = randomBytes(4).toString("hex");
    const destination = await prisma.destination.create({
      data: { name: "E2E Identity Coast", slug: `e2e-identity-coast-${suffix}`, country: "India" },
    });
    destinationId = destination.id;
    const hotel = await prisma.hotel.create({
      data: { destinationId, name: "E2E Identity Hotel", slug: `e2e-identity-hotel-${suffix}` },
    });
    hotelId = hotel.id;
    const request = await prisma.hotelInfoRequest.create({
      data: {
        reference: await nextHotelInfoRequestReference(prisma, at),
        kind: "onboarding",
        target: "existing",
        hotelId,
        expiresAt: new Date(at.getTime() + 30 * DAY_MS),
        tokenHash: hex(),
        linkIssuedAt: at,
      },
    });
    requestId = request.id;
  });

  afterAll(async () => {
    const people = { person: { requestId } };
    await prisma.hotelInfoRequestConsent.deleteMany({ where: people });
    await prisma.hotelInfoRequestChallenge.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequestEvent.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequest.update({
      where: { id: requestId },
      data: { submittedByPersonId: null, status: "revoked" },
    });
    await prisma.hotelInfoRequestPerson.deleteMany({ where: { requestId } });
    await prisma.hotelInfoRequest.deleteMany({ where: { id: requestId } });
    await prisma.hotel.deleteMany({ where: { id: hotelId } });
    await prisma.destination.deleteMany({ where: { id: destinationId } });
    await app.close();
  });

  describe("people", () => {
    it("holds one person per request and phone, and a removed person frees the phone", async () => {
      const first = await person();
      expect(first).toMatchObject({ phoneVerifiedAt: null, removedAt: null, lastSeenAt: null });
      await expect(person({ fullName: "Synthetic Twin" })).rejects.toThrow(
        /hotel_info_request_people_request_phone_live_key/,
      );
      const other = await person({ phone: OTHER_MOBILE });
      await prisma.hotelInfoRequestPerson.update({
        where: { id: first.id },
        data: { removedAt: at, removedBy: randomUUID() },
      });
      const returning = await person();
      await prisma.hotelInfoRequestPerson.updateMany({
        where: { id: { in: [returning.id, other.id] } },
        data: { removedAt: at },
      });
    });

    it("lets a soft-deleted person free the phone too", async () => {
      const deleted = await person({ phone: "+919000000003", deletedAt: at });
      const again = await person({ phone: "+919000000003" });
      expect(again.id).not.toBe(deleted.id);
    });

    it("stores phones in E.164 only", async () => {
      for (const phone of ["9000000004", "+91 90000 00004", "+0123456789", "+9190000000041234"]) {
        await expect(person({ phone }), phone).rejects.toThrow(
          /hotel_info_request_people_phone_e164/,
        );
      }
    });

    it("belongs to a request that exists", async () => {
      await expect(person({ requestId: randomUUID(), phone: "+919000000005" })).rejects.toThrow(
        /hotel_info_request_people_request_id_fkey/,
      );
    });
  });

  describe("code challenges", () => {
    it("start with no tries and allow 5 at most", async () => {
      const fresh = await challenge();
      expect(fresh).toMatchObject({ attempts: 0, usedAt: null, retiredAt: null, personId: null });
      await prisma.hotelInfoRequestChallenge.update({
        where: { id: fresh.id },
        data: { attempts: 5 },
      });
      for (const attempts of [6, -1]) {
        await expect(
          prisma.hotelInfoRequestChallenge.update({ where: { id: fresh.id }, data: { attempts } }),
          String(attempts),
        ).rejects.toThrow(/hotel_info_request_challenges_attempts_range/);
      }
    });

    it("clear the claim once the code is entered or the challenge is retired", async () => {
      const claim = {
        claimedFullName: null,
        claimedDesignation: null,
        claimedPhone: null,
        claimedNoticeVersion: null,
      };
      for (const ending of [{ usedAt: at }, { retiredAt: at }]) {
        const open = await challenge();
        await expect(
          prisma.hotelInfoRequestChallenge.update({ where: { id: open.id }, data: ending }),
          JSON.stringify(ending),
        ).rejects.toThrow(/hotel_info_request_challenges_claim_cleared/);
        await prisma.hotelInfoRequestChallenge.update({
          where: { id: open.id },
          data: { ...ending, ...claim },
        });
      }
    });

    it("name a person only once the code is entered, and carry a session only for that person", async () => {
      const verified = await person({ phone: "+919000000006" });
      const open = await challenge({ claimedPhone: "+919000000006" });
      await expect(
        prisma.hotelInfoRequestChallenge.update({
          where: { id: open.id },
          data: { personId: verified.id },
        }),
      ).rejects.toThrow(/hotel_info_request_challenges_person_on_use/);
      const cleared = {
        claimedFullName: null,
        claimedDesignation: null,
        claimedPhone: null,
        claimedNoticeVersion: null,
      };
      await expect(
        prisma.hotelInfoRequestChallenge.update({
          where: { id: open.id },
          data: { ...cleared, usedAt: at, sessionTokenHash: hex(), sessionStartedAt: at },
        }),
      ).rejects.toThrow(/hotel_info_request_challenges_session_on_verified/);
      const sessionTokenHash = hex();
      const opened = await prisma.hotelInfoRequestChallenge.update({
        where: { id: open.id },
        data: {
          ...cleared,
          usedAt: at,
          personId: verified.id,
          sessionTokenHash,
          sessionStartedAt: at,
        },
      });
      expect(opened).toMatchObject({
        personId: verified.id,
        sessionLastSeenAt: null,
        sessionEndedAt: null,
      });
      // A session's token hash is unique: one row answers for one token.
      const another = await challenge({ claimedPhone: "+919000000006" });
      await expect(
        prisma.hotelInfoRequestChallenge.update({
          where: { id: another.id },
          data: {
            ...cleared,
            usedAt: at,
            personId: verified.id,
            sessionTokenHash,
            sessionStartedAt: at,
          },
        }),
      ).rejects.toThrow(/hotel_info_request_challenges_session_token_hash_key/);
    });

    it("hold a claimed phone in E.164 only, and belong to a request that exists", async () => {
      await expect(challenge({ claimedPhone: "09000000007" })).rejects.toThrow(
        /hotel_info_request_challenges_claimed_phone_e164/,
      );
      await expect(challenge({ requestId: randomUUID() })).rejects.toThrow(
        /hotel_info_request_challenges_request_id_fkey/,
      );
    });
  });

  describe("consents", () => {
    it("record the privacy notice with no revision hash, and refuse one", async () => {
      const subject = await person({ phone: "+919000000008" });
      const consent = await prisma.hotelInfoRequestConsent.create({
        data: {
          personId: subject.id,
          kind: "privacy_notice",
          textVersion: "hf-notice-test",
          granted: true,
        },
      });
      expect(consent).toMatchObject({
        revisionHash: null,
        withdrawnAt: null,
        withdrawalSource: null,
      });
      expect(consent.recordedAt).toBeInstanceOf(Date);
      await expect(
        prisma.hotelInfoRequestConsent.create({
          data: {
            personId: subject.id,
            kind: "privacy_notice",
            textVersion: "hf-notice-test",
            granted: true,
            revisionHash: hex(),
          },
        }),
      ).rejects.toThrow(/hotel_info_request_consents_notice_has_no_revision/);
      await expect(
        prisma.hotelInfoRequestConsent.create({
          data: { personId: randomUUID(), kind: "privacy_notice", textVersion: "x", granted: true },
        }),
      ).rejects.toThrow(/hotel_info_request_consents_person_id_fkey/);
    });
  });

  describe("7a's person columns", () => {
    it("name a person of the hotel form, or nobody", async () => {
      const submitter = await person({ phone: "+919000000009" });
      await expect(
        prisma.hotelInfoRequest.update({
          where: { id: requestId },
          data: { submittedByPersonId: randomUUID() },
        }),
      ).rejects.toThrow(/hotel_info_requests_submitted_by_person_id_fkey/);
      await prisma.hotelInfoRequest.update({
        where: { id: requestId },
        data: { submittedByPersonId: submitter.id },
      });
      const base = { requestId, eventType: "updated" as const, actorKind: "hotel_person" as const };
      await expect(
        prisma.hotelInfoRequestEvent.create({ data: { ...base, actorPersonId: randomUUID() } }),
      ).rejects.toThrow(/hotel_info_request_events_actor_person_id_fkey/);
      const event = await prisma.hotelInfoRequestEvent.create({
        data: { ...base, actorPersonId: submitter.id },
      });
      expect(event.actorPersonId).toBe(submitter.id);
    });
  });

  it("creates the indexes D-189 names", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename IN
        ('hotel_info_request_people', 'hotel_info_request_challenges', 'hotel_info_request_consents')`;
    expect(rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "hotel_info_request_people_request_phone_live_key",
        "hotel_info_request_people_request_id_idx",
        "hotel_info_request_challenges_session_token_hash_key",
        "hotel_info_request_challenges_request_id_destination_hash_c_idx",
        "hotel_info_request_challenges_person_id_idx",
        "hotel_info_request_consents_person_id_kind_idx",
      ]),
    );
  });
});
