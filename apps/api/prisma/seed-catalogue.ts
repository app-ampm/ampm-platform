import type { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { CATALOGUE_DESTINATIONS, CATALOGUE_HOTELS } from "./seed-catalogue.data.js";
import { mapsLink, nextSeasonItems, seasonItems } from "./seed-catalogue.items.js";
import type { CatalogueHotel } from "./seed-catalogue.types.js";

/*
 * The starter hotel catalogue load (D-159): five real wedding hotels with rough details, each with every
 * record a hotel can carry here (rooms, venues, a placeholder contact, a verification per field group, a
 * verified client-visible rate card and a draft card for next season). It is CREATE-ONLY, so it is safe
 * in production: a hotel whose slug exists (live or soft-deleted) is left alone, and an existing
 * destination only gets a missing description, so a re-run never overwrites the Hotel team's edits.
 * Photos and previous-wedding references are left to the team: both need rights or consent (GP-20).
 * prisma/load-catalogue.ts runs it in production; seed.ts runs it for development and the e2e tests.
 */

type Tx = Prisma.TransactionClient;
type FieldGroup = Prisma.HotelVerificationCreateManyInput["fieldGroup"];

export type CatalogueOutcome = {
  destinationsCreated: string[];
  hotelsCreated: string[];
  hotelsSkipped: string[];
};

export type CatalogueOptions = {
  /** Report what would be created and write nothing. */
  dryRun?: boolean;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECHECK_DAYS = 30;
const SOURCE_NOTE = "Rough figures from the hotel's website and public travel listings (D-159).";
const CHECK_NOTE =
  "Starter catalogue: confirm every figure with the hotel before quoting a client.";
/** The repo's reserved phone range (data.md): a placeholder nobody answers. */
const PLACEHOLDER_PHONE = "+911234567100";

/** What each field group starts as: the groups filled from public sources are verified (website). */
const VERIFICATIONS: readonly { fieldGroup: FieldGroup; isVerified: boolean; notes: string }[] = [
  { fieldGroup: "profile", isVerified: true, notes: SOURCE_NOTE },
  { fieldGroup: "rooms", isVerified: true, notes: SOURCE_NOTE },
  { fieldGroup: "venues", isVerified: true, notes: SOURCE_NOTE },
  { fieldGroup: "rates", isVerified: true, notes: SOURCE_NOTE },
  {
    fieldGroup: "contacts",
    isVerified: false,
    notes: "Placeholder: add the wedding sales manager.",
  },
  { fieldGroup: "media", isVerified: false, notes: "No photos yet: upload rights-cleared images." },
  { fieldGroup: "availability", isVerified: false, notes: "Ask the hotel for open wedding dates." },
];

/** The hotel row with every column filled: active, not demo-visible, not on the public website. */
async function createProfile(tx: Tx, hotel: CatalogueHotel, destinationId: string, now: Date) {
  const { destination: _slug, rooms: _rooms, venues: _venues, rates: _rates, ...profile } = hotel;
  const row = await tx.hotel.create({
    data: {
      ...profile,
      destinationId,
      status: "active",
      demoVisible: false,
      publicShowcase: false,
      streetViewRef: mapsLink(hotel),
      internalNotes: CHECK_NOTE,
      lastVerifiedAt: now,
    },
    select: { id: true },
  });
  return row.id;
}

/** Rooms and venues one at a time, so their ids line up with the data for the rate lines. */
async function createRoomsAndVenues(tx: Tx, hotelId: string, hotel: CatalogueHotel) {
  const roomIds: string[] = [];
  for (const { rate: _rate, nextRate: _next, ...room } of hotel.rooms) {
    const row = await tx.hotelRoomCategory.create({
      data: { ...room, hotelId },
      select: { id: true },
    });
    roomIds.push(row.id);
  }
  const venueIds: string[] = [];
  for (const { rental: _rental, ...venue } of hotel.venues) {
    const row = await tx.hotelVenue.create({ data: { ...venue, hotelId }, select: { id: true } });
    venueIds.push(row.id);
  }
  return { roomIds, venueIds };
}

/** One verification per field group; returns the rates one, which the verified card cites (AC-04.4). */
async function createVerifications(tx: Tx, hotelId: string, now: Date): Promise<string> {
  const nextDueAt = new Date(now.getTime() + RECHECK_DAYS * DAY_MS);
  let ratesId: string | null = null;
  for (const { fieldGroup, isVerified, notes } of VERIFICATIONS) {
    const verified = { status: "verified", source: "website", verifiedAt: now } as const;
    const row = await tx.hotelVerification.create({
      data: { hotelId, fieldGroup, nextDueAt, notes, ...(isVerified ? verified : {}) },
      select: { id: true },
    });
    if (fieldGroup === "rates") ratesId = row.id;
  }
  if (!ratesId) throw new Error("the catalogue verifications have no rates group");
  return ratesId;
}

type CardIds = { roomIds: string[]; venueIds: string[]; verificationId: string };

/** This season's verified card (it cites the rates verification) and next season's draft. */
async function createRateCards(tx: Tx, hotelId: string, hotel: CatalogueHotel, ids: CardIds) {
  await tx.hotelRateCard.create({
    data: {
      hotelId,
      name: "Wedding season 2026–27",
      status: "verified",
      verificationId: ids.verificationId,
      validFrom: new Date("2026-10-01T00:00:00.000Z"),
      validTo: new Date("2027-09-30T00:00:00.000Z"),
      source: SOURCE_NOTE,
      internalNotes: CHECK_NOTE,
      items: { createMany: { data: seasonItems(hotel, ids.roomIds, ids.venueIds) } },
    },
  });
  await tx.hotelRateCard.create({
    data: {
      hotelId,
      name: "Wedding season 2027–28",
      status: "draft",
      validFrom: new Date("2027-10-01T00:00:00.000Z"),
      validTo: new Date("2028-09-30T00:00:00.000Z"),
      source: SOURCE_NOTE,
      internalNotes:
        "Next season: an assumed uplift on this season's figures; confirm, then verify.",
      items: { createMany: { data: nextSeasonItems(hotel, ids.roomIds) } },
    },
  });
}

/** One hotel and everything under it in one transaction, with a system audit event for the create. */
async function createHotel(
  prisma: PrismaClient,
  hotel: CatalogueHotel,
  destinationId: string,
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const hotelId = await createProfile(tx, hotel, destinationId, now);
    const { roomIds, venueIds } = await createRoomsAndVenues(tx, hotelId, hotel);
    await tx.hotelContact.create({
      data: {
        hotelId,
        name: "Wedding sales (placeholder)",
        roleTitle: "Wedding sales manager, to confirm",
        phone: PLACEHOLDER_PHONE,
        email: `weddings.${hotel.slug}@example.com`,
        isPrimary: true,
      },
    });
    const verificationId = await createVerifications(tx, hotelId, now);
    await createRateCards(tx, hotelId, hotel, { roomIds, venueIds, verificationId });
    await tx.auditEvent.create({
      data: {
        actorType: "system",
        action: "create",
        entityType: "hotel",
        entityId: hotelId,
        afterJson: { slug: hotel.slug, name: hotel.name, source: "catalogue_load" },
      },
    });
  });
}

/** Creates the missing destinations and fills a missing description; returns every id by slug. */
async function ensureDestinations(prisma: PrismaClient, isDryRun: boolean) {
  const existing = await prisma.destination.findMany({
    where: { slug: { in: CATALOGUE_DESTINATIONS.map((destination) => destination.slug) } },
    select: { id: true, slug: true, description: true },
  });
  const ids = new Map(existing.map((row) => [row.slug, row.id]));
  const created: string[] = [];
  for (const destination of CATALOGUE_DESTINATIONS) {
    const found = existing.find((row) => row.slug === destination.slug);
    if (found) {
      if (found.description === null && !isDryRun) {
        const data = { description: destination.description };
        await prisma.destination.update({ where: { id: found.id }, data });
      }
      continue;
    }
    created.push(destination.slug);
    if (isDryRun) continue;
    const data = { ...destination, country: "India", status: "active" } as const;
    ids.set(destination.slug, (await prisma.destination.create({ data })).id);
  }
  return { ids, created };
}

/**
 * Loads the starter catalogue: creates each hotel that does not exist yet and leaves every existing one
 * untouched. Idempotent; with `dryRun` it only reports.
 *
 * @example
 * const outcome = await seedCatalogue(prisma, { dryRun: true }); // outcome.hotelsCreated: would-create
 */
export async function seedCatalogue(
  prisma: PrismaClient,
  options: CatalogueOptions = {},
): Promise<CatalogueOutcome> {
  const isDryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const { ids, created } = await ensureDestinations(prisma, isDryRun);
  const present = await prisma.hotel.findMany({
    where: { slug: { in: CATALOGUE_HOTELS.map((hotel) => hotel.slug) } },
    select: { slug: true },
  });
  const presentSlugs = new Set(present.map((row) => row.slug));
  const outcome: CatalogueOutcome = {
    destinationsCreated: created,
    hotelsCreated: [],
    hotelsSkipped: [],
  };
  for (const hotel of CATALOGUE_HOTELS) {
    const list = presentSlugs.has(hotel.slug) ? outcome.hotelsSkipped : outcome.hotelsCreated;
    list.push(hotel.slug);
    if (isDryRun || presentSlugs.has(hotel.slug)) continue;
    const destinationId = ids.get(hotel.destination);
    if (!destinationId) throw new Error(`destination ${hotel.destination} is not in the catalogue`);
    await createHotel(prisma, hotel, destinationId, now);
  }
  return outcome;
}
