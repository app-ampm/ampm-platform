import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelFreshnessService } from "../src/modules/hotels/hotel-freshness.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-fresh-";
const DAY = 24 * 60 * 60 * 1000;

/**
 * The rate-freshness sweep (Module C, feature 9.2; AC-04.3). A verification older than the configured
 * max age (default 90 days) and its rate cards go stale; a fresh one stays; hotels.last_verified_at is
 * the newest verification; the hotel team is notified once; a second run changes nothing.
 */
describe("Hotel rate freshness (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let freshness: HotelFreshnessService;
  let hotelId: string;
  let oldVerificationId: string;
  let freshVerificationId: string;
  let cardId: string;
  let htUserId: string;

  async function removeFixtures(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { identitySubject: `${PREFIX}ht` },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    }
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((h) => h.id);
    if (ids.length > 0) {
      await prisma.hotelRateCard.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotelVerification.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    freshness = app.get(HotelFreshnessService);
    await removeFixtures();

    const htRole = await prisma.role.findFirstOrThrow({ where: { roleKey: "hotel_team" } });
    const htUser = await prisma.user.create({
      data: {
        userType: "staff",
        name: "E2E Hotel Team",
        email: `${PREFIX}ht@example.com`,
        status: "active",
        identitySubject: `${PREFIX}ht`,
        roles: { create: { roleId: htRole.id } },
      },
    });
    htUserId = htUser.id;

    const dest = await prisma.destination.create({
      data: {
        name: "E2E Fresh Destination",
        slug: `${PREFIX}dest`,
        country: "India",
        status: "active",
      },
    });
    const hotel = await prisma.hotel.create({
      data: {
        destinationId: dest.id,
        name: "E2E Fresh Hotel",
        slug: `${PREFIX}hotel`,
        status: "active",
      },
    });
    hotelId = hotel.id;

    const old = await prisma.hotelVerification.create({
      data: {
        hotelId,
        fieldGroup: "rates",
        source: "email",
        status: "verified",
        verifiedAt: new Date(Date.now() - 200 * DAY),
      },
    });
    oldVerificationId = old.id;
    const fresh = await prisma.hotelVerification.create({
      data: {
        hotelId,
        fieldGroup: "profile",
        source: "email",
        status: "verified",
        verifiedAt: new Date(Date.now() - 10 * DAY),
      },
    });
    freshVerificationId = fresh.id;
    const card = await prisma.hotelRateCard.create({
      data: {
        hotelId,
        name: "Season 2027",
        currency: "INR",
        status: "verified",
        verificationId: old.id,
      },
    });
    cardId = card.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("stales the over-age verification and its card, keeps the fresh one, and notifies HT once", async () => {
    const result = await freshness.runSweep();
    expect(result).toEqual({ staledVerifications: 1, staledCards: 1 });

    expect(
      (await prisma.hotelVerification.findUniqueOrThrow({ where: { id: oldVerificationId } }))
        .status,
    ).toBe("stale");
    expect(
      (await prisma.hotelVerification.findUniqueOrThrow({ where: { id: freshVerificationId } }))
        .status,
    ).toBe("verified");
    expect((await prisma.hotelRateCard.findUniqueOrThrow({ where: { id: cardId } })).status).toBe(
      "stale",
    );

    const fresh = await prisma.hotelVerification.findUniqueOrThrow({
      where: { id: freshVerificationId },
    });
    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
    expect(hotel.lastVerifiedAt?.toISOString()).toBe(fresh.verifiedAt?.toISOString());

    const notices = await prisma.notification.count({
      where: { recipientId: htUserId, templateKey: "hotels.rates_stale" },
    });
    expect(notices).toBe(1);
  });

  it("is idempotent — a second run stales nothing and sends no new notice", async () => {
    expect(await freshness.runSweep()).toEqual({ staledVerifications: 0, staledCards: 0 });
    const notices = await prisma.notification.count({
      where: { recipientId: htUserId, templateKey: "hotels.rates_stale" },
    });
    expect(notices).toBe(1);
  });
});
