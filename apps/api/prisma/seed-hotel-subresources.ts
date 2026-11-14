import type { PrismaClient } from "../src/generated/prisma/client.js";

import {
  RATES_VERIFIED_AT,
  SUBRESOURCES,
  type HotelSubresources,
} from "./seed-hotel-subresources.data.js";

/*
 * Module C demo depth (data.md: synthetic only). Builds venues, room categories and one verified, client-
 * visible rate card for each of the four seeded hotels, so the shipped discovery slices render real figures
 * on a demo box: B11 card price/capacity, B3 venues, B5 rooms and B7's capacity / verified-rates filters.
 * A verified card needs a verification (AC-04.4), so each hotel also gets a rates HotelVerification its card
 * cites. Runs after seedHotels (needs their ids) and before the consultancy demo. Data lives in the sibling
 * file; this is the (re-run safe) upsert logic — each hotel's children are cleared and rebuilt every run.
 */

/** Clears a hotel's seeded children in FK order (items → cards → verifications → venues → rooms) so the seed re-runs clean. */
async function clearChildren(prisma: PrismaClient, hotelId: string): Promise<void> {
  await prisma.hotelRateItem.deleteMany({ where: { rateCard: { hotelId } } });
  await prisma.hotelRateCard.deleteMany({ where: { hotelId } });
  await prisma.hotelVerification.deleteMany({ where: { hotelId } });
  await prisma.hotelVenue.deleteMany({ where: { hotelId } });
  await prisma.hotelRoomCategory.deleteMany({ where: { hotelId } });
}

/** Creates one hotel's venues and room categories (CP-05 profile data). */
async function createProfile(
  prisma: PrismaClient,
  hotelId: string,
  sub: HotelSubresources,
): Promise<void> {
  await prisma.hotelVenue.createMany({ data: sub.venues.map((venue) => ({ ...venue, hotelId })) });
  await prisma.hotelRoomCategory.createMany({
    data: sub.rooms.map((room) => ({ ...room, hotelId })),
  });
}

/** Creates the rates verification and the verified, client-visible rate card that cites it (AC-04). */
async function createRateCard(
  prisma: PrismaClient,
  hotelId: string,
  sub: HotelSubresources,
): Promise<void> {
  const verification = await prisma.hotelVerification.create({
    data: {
      hotelId,
      fieldGroup: "rates",
      status: "verified",
      source: "contract",
      verifiedAt: RATES_VERIFIED_AT,
    },
    select: { id: true },
  });
  await prisma.hotelRateCard.create({
    data: {
      hotelId,
      name: sub.rateCardName,
      currency: "INR",
      status: "verified",
      verificationId: verification.id,
      validFrom: new Date("2026-10-01T00:00:00.000Z"),
      validTo: new Date("2027-09-30T00:00:00.000Z"),
      items: {
        create: sub.rateItems.map((item) => ({
          itemType: item.itemType,
          unit: item.unit,
          amount: item.amount,
          amountMax: item.amountMax,
          isIndicative: true,
          clientVisible: true,
          inclusionsText: item.inclusions,
        })),
      },
    },
  });
}

/**
 * Seeds venues, rooms and one verified client-visible rate card for each synthetic hotel. Idempotent: each
 * hotel's children are cleared and rebuilt, so the nightly demo restore and a re-run both land the same data.
 */
export async function seedHotelSubresources(prisma: PrismaClient): Promise<void> {
  const slugs = SUBRESOURCES.map((sub) => sub.slug);
  const hotels = await prisma.hotel.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(hotels.map((hotel) => [hotel.slug, hotel.id]));
  for (const sub of SUBRESOURCES) {
    const hotelId = idBySlug.get(sub.slug);
    if (!hotelId) throw new Error(`hotel ${sub.slug} was not seeded`);
    await clearChildren(prisma, hotelId);
    await createProfile(prisma, hotelId, sub);
    await createRateCard(prisma, hotelId, sub);
  }
}
