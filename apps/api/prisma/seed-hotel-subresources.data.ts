import type { HotelRoomUnitType } from "@ampm/core";

import { SEED_VENUES, type VenueSeed } from "./seed-hotel-subresources.venues.js";

/*
 * Module C demo depth (data.md: synthetic only) — the room categories and rate items for the four seeded
 * hotels; their venues are in seed-hotel-subresources.venues.ts. Every rate card is VERIFIED with
 * client-visible items (the only way a price reaches a client; AC-04), every item is indicative and never
 * an internal cost (security.md), and each hotel keeps a `room_rate` so the B11 card always shows a
 * per-night range. A few rooms state their unit type (D-178). Data only; the seed logic is in the sibling
 * file.
 */

export type RoomSeed = {
  name: string;
  /** What the category is (D-178); left out where a fact sheet would not say. */
  unitType?: HotelRoomUnitType;
  roomCount: number;
  maxOccupancy: number;
  sizeSqm: number;
  facilities: string[];
  description: string;
};

/** Amounts are rupees (the Decimal(14,2) column); the read path converts to paise. `amount`..`amountMax` is the indicative range. */
export type RateItemSeed = {
  itemType: "room_rate" | "wedding_package" | "per_plate_veg" | "per_plate_non_veg";
  unit: "per_night" | "per_event" | "per_plate";
  amount: number;
  amountMax: number;
  inclusions: string;
};

export type HotelSubresources = {
  slug: string;
  venues: VenueSeed[];
  rooms: RoomSeed[];
  rateCardName: string;
  rateItems: RateItemSeed[];
};

/** The rates verification each verified card points at — recent, so the freshness label reads "verified". */
export const RATES_VERIFIED_AT = new Date("2026-11-02T06:30:00.000Z");

export const SUBRESOURCES: readonly HotelSubresources[] = [
  {
    slug: "lake-pavilion-udaipur",
    venues: SEED_VENUES["lake-pavilion-udaipur"],
    rooms: [
      {
        name: "Lake-View Suite",
        unitType: "suite",
        roomCount: 24,
        maxOccupancy: 3,
        sizeSqm: 65,
        facilities: ["Lake balcony", "Living area", "Mini bar"],
        description: "Corner suites facing the lake, for the couple and close family.",
      },
      {
        name: "Heritage Room",
        roomCount: 60,
        maxOccupancy: 2,
        sizeSqm: 42,
        facilities: ["Courtyard view", "Work desk"],
        description: "Classic rooms around the central courtyard for the wedding party.",
      },
    ],
    rateCardName: "Wedding Season 2026–27",
    rateItems: [
      {
        itemType: "room_rate",
        unit: "per_night",
        amount: 18000,
        amountMax: 26000,
        inclusions: "Room with breakfast; taxes extra.",
      },
      {
        itemType: "wedding_package",
        unit: "per_event",
        amount: 1200000,
        amountMax: 1800000,
        inclusions: "Venue, décor base and standard lighting for one function day.",
      },
    ],
  },
  {
    slug: "aravalli-retreat-udaipur",
    venues: SEED_VENUES["aravalli-retreat-udaipur"],
    rooms: [
      {
        name: "Hill-View Room",
        roomCount: 40,
        maxOccupancy: 2,
        sizeSqm: 38,
        facilities: ["Hill view", "Tea/coffee"],
        description: "Comfortable rooms overlooking the valley.",
      },
      {
        name: "Garden Suite",
        unitType: "suite",
        roomCount: 12,
        maxOccupancy: 3,
        sizeSqm: 55,
        facilities: ["Private sit-out", "Living area"],
        description: "Ground-floor suites opening onto the garden.",
      },
    ],
    rateCardName: "Boutique Rates 2026–27",
    rateItems: [
      {
        itemType: "room_rate",
        unit: "per_night",
        amount: 9000,
        amountMax: 14000,
        inclusions: "Room with breakfast; taxes extra.",
      },
      {
        itemType: "per_plate_veg",
        unit: "per_plate",
        amount: 1400,
        amountMax: 1900,
        inclusions: "Vegetarian set menu; minimum 120 covers.",
      },
    ],
  },
  {
    slug: "rose-fort-jaipur",
    venues: SEED_VENUES["rose-fort-jaipur"],
    rooms: [
      {
        name: "Palace Suite",
        unitType: "suite",
        roomCount: 30,
        maxOccupancy: 3,
        sizeSqm: 70,
        facilities: ["Fort view", "Living area", "Mini bar"],
        description: "Suites in the restored palace wing.",
      },
      {
        name: "Royal Room",
        roomCount: 90,
        maxOccupancy: 2,
        sizeSqm: 45,
        facilities: ["Courtyard view", "Work desk"],
        description: "Well-appointed rooms for the wedding party.",
      },
    ],
    rateCardName: "Wedding Season 2026–27",
    rateItems: [
      {
        itemType: "room_rate",
        unit: "per_night",
        amount: 22000,
        amountMax: 32000,
        inclusions: "Room with breakfast; taxes extra.",
      },
      {
        itemType: "wedding_package",
        unit: "per_event",
        amount: 1800000,
        amountMax: 2600000,
        inclusions: "Venue, décor base and lighting for one function day.",
      },
    ],
  },
  {
    slug: "candolim-sands-goa",
    venues: SEED_VENUES["candolim-sands-goa"],
    rooms: [
      {
        name: "Sea-View Room",
        roomCount: 100,
        maxOccupancy: 2,
        sizeSqm: 40,
        facilities: ["Sea view", "Balcony"],
        description: "Bright rooms facing the Arabian Sea.",
      },
      {
        name: "Beach Villa",
        unitType: "villa",
        roomCount: 20,
        maxOccupancy: 4,
        sizeSqm: 90,
        facilities: ["Private deck", "Plunge pool", "Living area"],
        description: "Standalone villas steps from the sand.",
      },
    ],
    rateCardName: "Beach Wedding Season 2026–27",
    rateItems: [
      {
        itemType: "room_rate",
        unit: "per_night",
        amount: 15000,
        amountMax: 22000,
        inclusions: "Room with breakfast; taxes extra.",
      },
      {
        itemType: "wedding_package",
        unit: "per_event",
        amount: 1500000,
        amountMax: 2200000,
        inclusions: "Beach venue, décor base and lighting for one function day.",
      },
    ],
  },
];
