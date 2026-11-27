import { randomBytes } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { nextHotelInfoRequestReference } from "../src/modules/hotels/hotel-info-request-reference.js";
import { startApi } from "./start-api.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const at = new Date("2026-11-24T10:00:00.000Z");

/** The number part of a reference, `HIR-2026-0042` → 42. */
function numberOf(reference: string): number {
  return Number(reference.split("-")[2]);
}

/**
 * The hotel information request tables of migration 20261128000000_hotel_info_requests (D-188 §1)
 * against the migrated test database: the reference sequence, the live-request indexes and the checks,
 * the new-hotel one as 20261203000000_hotel_info_request_optional_website widened it (D-192).
 * Synthetic rows only; every row this file writes is removed after it.
 */
describe("Hotel information requests: the data (e2e, D-188 §1)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let destinationId: string;
  let hotelId: string;
  let otherHotelId: string;

  const base = async (overrides: Record<string, unknown> = {}) => ({
    reference: await nextHotelInfoRequestReference(prisma, at),
    kind: "onboarding" as const,
    target: "existing" as const,
    hotelId,
    expiresAt: new Date(at.getTime() + 30 * DAY_MS),
    tokenHash: randomBytes(32).toString("hex"),
    linkIssuedAt: at,
    ...overrides,
  });

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    const suffix = randomBytes(4).toString("hex");
    const destination = await prisma.destination.create({
      data: { name: "E2E Request Coast", slug: `e2e-request-coast-${suffix}`, country: "India" },
    });
    destinationId = destination.id;
    const hotel = await prisma.hotel.create({
      data: { destinationId, name: "E2E Request Hotel", slug: `e2e-request-hotel-${suffix}` },
    });
    const other = await prisma.hotel.create({
      data: { destinationId, name: "E2E Request Annex", slug: `e2e-request-annex-${suffix}` },
    });
    hotelId = hotel.id;
    otherHotelId = other.id;
  });

  afterAll(async () => {
    const mine = {
      OR: [{ hotelId: { in: [hotelId, otherHotelId] } }, { proposedDestinationId: destinationId }],
    };
    await prisma.hotelInfoRequestEvent.deleteMany({ where: { request: mine } });
    await prisma.hotelInfoRequest.deleteMany({ where: mine });
    await prisma.hotel.deleteMany({ where: { id: { in: [hotelId, otherHotelId] } } });
    await prisma.destination.deleteMany({ where: { id: destinationId } });
    await app.close();
  });

  it("draws HIR, the creation year (UTC) and the next number, four digits at least, never reset", async () => {
    const first = await nextHotelInfoRequestReference(prisma, at);
    const second = await nextHotelInfoRequestReference(prisma, at);
    expect(first).toMatch(/^HIR-2026-\d{4,}$/);
    expect(numberOf(second)).toBe(numberOf(first) + 1);
    // 31 December 2026, 23:30 in India, is still 2026 in UTC; the year never resets the sequence.
    const lateEvening = await nextHotelInfoRequestReference(
      prisma,
      new Date("2026-12-31T18:00:00.000Z"),
    );
    const newYear = await nextHotelInfoRequestReference(prisma, new Date("2027-01-01T00:00:00Z"));
    expect(lateEvening).toMatch(/^HIR-2026-/);
    expect(newYear).toMatch(/^HIR-2027-/);
    expect(numberOf(newYear)).toBe(numberOf(second) + 2);
  });

  it("draws inside transactions, and concurrent transactions never draw the same number", async () => {
    const references = await Promise.all(
      Array.from({ length: 6 }, () =>
        prisma.$transaction((tx) => nextHotelInfoRequestReference(tx, at)),
      ),
    );
    expect(new Set(references).size).toBe(6);
  });

  it("holds one live request per hotel, and a merged, rejected or revoked one frees it", async () => {
    const first = await prisma.hotelInfoRequest.create({ data: await base() });
    expect(first).toMatchObject({
      status: "open",
      tokenGeneration: 1,
      revision: 0,
      prefillMode: "none",
      isTest: false,
      retentionClass: "hotel_intake",
    });
    for (const status of ["open", "submitted", "in_review", "changes_requested"] as const) {
      await prisma.hotelInfoRequest.update({ where: { id: first.id }, data: { status } });
      await expect(
        prisma.hotelInfoRequest.create({ data: await base() }),
        `while the first is ${status}`,
      ).rejects.toThrow(/hotel_info_requests_hotel_live_key/);
    }
    for (const status of ["merged", "rejected", "revoked"] as const) {
      await prisma.hotelInfoRequest.update({ where: { id: first.id }, data: { status } });
      const next = await prisma.hotelInfoRequest.create({ data: await base() });
      await prisma.hotelInfoRequest.update({ where: { id: next.id }, data: { status: "revoked" } });
    }
  });

  it("lets a soft-deleted live request free the hotel too", async () => {
    const live = await prisma.hotelInfoRequest.create({
      data: await base({ hotelId: otherHotelId }),
    });
    await prisma.hotelInfoRequest.update({ where: { id: live.id }, data: { deletedAt: at } });
    const next = await prisma.hotelInfoRequest.create({
      data: await base({ hotelId: otherHotelId }),
    });
    await prisma.hotelInfoRequest.update({ where: { id: next.id }, data: { status: "revoked" } });
  });

  it("holds one live new-hotel request per normalised web address", async () => {
    const proposal = (key: string) => ({
      target: "new" as const,
      hotelId: null,
      proposedName: "E2E Proposed Retreat",
      proposedDestinationId: destinationId,
      proposedWebAddress: `${key}/`,
      proposedWebAddressKey: key,
    });
    const key = `https://e2e-${randomBytes(4).toString("hex")}.example`;
    const first = await prisma.hotelInfoRequest.create({ data: await base(proposal(key)) });
    await expect(
      prisma.hotelInfoRequest.create({ data: await base(proposal(key)) }),
    ).rejects.toThrow(/hotel_info_requests_web_address_live_key/);
    const elsewhere = await prisma.hotelInfoRequest.create({
      data: await base(proposal(`${key}/another`)),
    });
    await prisma.hotelInfoRequest.update({ where: { id: first.id }, data: { status: "rejected" } });
    const again = await prisma.hotelInfoRequest.create({ data: await base(proposal(key)) });
    await prisma.hotelInfoRequest.updateMany({
      where: { id: { in: [elsewhere.id, again.id] } },
      data: { status: "revoked" },
    });
  });

  it("refuses an existing-hotel request without its hotel, and a new-hotel request without its name or destination", async () => {
    await expect(
      prisma.hotelInfoRequest.create({ data: await base({ hotelId: null }) }),
    ).rejects.toThrow(/hotel_info_requests_existing_has_hotel/);
    for (const missing of ["proposedName", "proposedDestinationId"]) {
      const proposal: Record<string, unknown> = {
        target: "new",
        hotelId: null,
        proposedName: "E2E Proposed Lodge",
        proposedDestinationId: destinationId,
        proposedWebAddressKey: `https://e2e-${randomBytes(4).toString("hex")}.example`,
      };
      delete proposal[missing];
      await expect(
        prisma.hotelInfoRequest.create({ data: await base(proposal) }),
        missing,
      ).rejects.toThrow(/hotel_info_requests_new_has_name_and_destination/);
    }
  });

  it("takes new-hotel requests with no website, two live in one destination: a null key holds no address (D-192)", async () => {
    const unsited = {
      target: "new" as const,
      hotelId: null,
      proposedName: "E2E Unsited Lodge",
      proposedDestinationId: destinationId,
      proposedWebAddress: null,
      proposedWebAddressKey: null,
    };
    const first = await prisma.hotelInfoRequest.create({ data: await base(unsited) });
    const second = await prisma.hotelInfoRequest.create({ data: await base(unsited) });
    expect(second).toMatchObject({ status: "open", proposedWebAddressKey: null });
    await prisma.hotelInfoRequest.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { status: "revoked" },
    });
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'hotel_info_requests'::regclass AND contype = 'c'`;
    const names = checks.map((row) => row.conname);
    expect(names).toContain("hotel_info_requests_new_has_name_and_destination");
    expect(names).not.toContain("hotel_info_requests_new_has_proposal");
  });

  it("keeps each link's hash and each reference unique", async () => {
    const tokenHash = randomBytes(32).toString("hex");
    const kept = await prisma.hotelInfoRequest.create({ data: await base({ tokenHash }) });
    await prisma.hotelInfoRequest.update({ where: { id: kept.id }, data: { status: "revoked" } });
    await expect(
      prisma.hotelInfoRequest.create({ data: await base({ tokenHash }) }),
    ).rejects.toThrow(/hotel_info_requests_token_hash_key/);
    await expect(
      prisma.hotelInfoRequest.create({ data: await base({ reference: kept.reference }) }),
    ).rejects.toThrow(/hotel_info_requests_reference_key/);
  });

  it("records events against their request, the actor's kind and a masked detail", async () => {
    const request = await prisma.hotelInfoRequest.create({
      data: await base({ hotelId: otherHotelId }),
    });
    const event = await prisma.hotelInfoRequestEvent.create({
      data: {
        requestId: request.id,
        eventType: "revoked",
        actorKind: "system",
        detail: { reason: "hotel_deleted" },
      },
    });
    expect(event).toMatchObject({ actorUserId: null, actorPersonId: null });
    expect(event.occurredAt).toBeInstanceOf(Date);
    await prisma.hotelInfoRequest.update({
      where: { id: request.id },
      data: { status: "revoked" },
    });
  });

  it("creates the indexes D-188 names", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'hotel_info_requests'`;
    const names = rows.map((row) => row.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "hotel_info_requests_hotel_live_key",
        "hotel_info_requests_web_address_live_key",
        "hotel_info_requests_status_expires_at_idx",
        "hotel_info_requests_status_submitted_at_idx",
        "hotel_info_requests_token_hash_key",
        "hotel_info_requests_reference_key",
      ]),
    );
  });
});
