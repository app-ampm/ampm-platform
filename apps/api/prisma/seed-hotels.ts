import type { PrismaClient } from "../src/generated/prisma/client.js";

/*
 * Module C seed (data.md: synthetic only). The three demo destinations (real places) and four fictitious
 * hotels at them — three demo-visible, one (the second Udaipur property) not — so an entitled client sees
 * four and a demo principal sees three (A-28 isolation). internal_rating / internal_notes are set to prove
 * the client path never serialises them (RESTRICTED-NOTES). last_verified_at drives the freshness label
 * (seeded directly until the hotel-verification workflow lands). Kept out of seed.ts to keep it under the
 * 300-line cap.
 */

const DESTINATIONS = [
  { slug: "udaipur", name: "Udaipur", region: "Mewar", state: "Rajasthan" },
  { slug: "jaipur", name: "Jaipur", region: "Dhundhar", state: "Rajasthan" },
  { slug: "goa", name: "Goa", region: "North Goa", state: "Goa" },
] as const;

const HOTELS = [
  {
    slug: "lake-pavilion-udaipur",
    name: "The Lake Pavilion",
    destination: "udaipur",
    brand: "Pavilion Collection",
    starCategory: "5",
    demoVisible: true,
    totalRooms: 84,
    address: "Lake Pichola Road, Udaipur, Rajasthan 313001",
    website: "https://example.com/lake-pavilion",
    descriptionClient:
      "A heritage-style lakeside palace with courtyard lawns for destination weddings.",
  },
  {
    slug: "aravalli-retreat-udaipur",
    name: "Aravalli Hill Retreat",
    destination: "udaipur",
    brand: null,
    starCategory: "4",
    demoVisible: false,
    totalRooms: 52,
    address: "Sajjangarh Road, Udaipur, Rajasthan 313001",
    website: null,
    descriptionClient: "A quiet boutique hill resort on the edge of the city.",
  },
  {
    slug: "rose-fort-jaipur",
    name: "Rose Fort Palace",
    destination: "jaipur",
    brand: "Rose Collection",
    starCategory: "5",
    demoVisible: true,
    totalRooms: 120,
    address: "Amer Road, Jaipur, Rajasthan 302002",
    website: "https://example.com/rose-fort",
    descriptionClient: "A fort-palace with expansive courtyard lawns for large functions.",
  },
  {
    slug: "candolim-sands-goa",
    name: "Candolim Sands Resort",
    destination: "goa",
    brand: null,
    starCategory: "5",
    demoVisible: true,
    totalRooms: 160,
    address: "Candolim Beach Road, North Goa 403515",
    website: "https://example.com/candolim-sands",
    descriptionClient: "A beachfront resort for seaside wedding events and sundown receptions.",
  },
] as const;

/** The three demo destinations (real places); returns their ids keyed by slug for the hotels. */
async function seedDestinations(prisma: PrismaClient): Promise<ReadonlyMap<string, string>> {
  const ids = new Map<string, string>();
  for (const row of DESTINATIONS) {
    const destination = await prisma.destination.upsert({
      where: { slug: row.slug },
      update: { name: row.name, region: row.region, state: row.state, status: "active" },
      create: { ...row, country: "India", status: "active" },
      select: { id: true },
    });
    ids.set(row.slug, destination.id);
  }
  return ids;
}

/** Upserts the destinations then the hotels (idempotent, keyed on slug). */
export async function seedHotels(prisma: PrismaClient): Promise<void> {
  const destinations = await seedDestinations(prisma);
  const lastVerifiedAt = new Date("2026-10-15T00:00:00.000Z");
  for (const { slug, destination, ...rest } of HOTELS) {
    const destinationId = destinations.get(destination);
    if (!destinationId) throw new Error(`destination ${destination} was not seeded`);
    const data = {
      ...rest,
      destinationId,
      status: "active" as const,
      lastVerifiedAt,
      internalRating: 4,
      internalNotes: "Synthetic internal note — never shown to a client.",
    };
    await prisma.hotel.upsert({ where: { slug }, update: data, create: { slug, ...data } });
  }
}
