/*
 * Module C demo depth (data.md: synthetic only) — the venues, room categories and rate items for the four
 * seeded hotels. Every rate card is VERIFIED with client-visible items (the only way a price reaches a
 * client; AC-04), every item is indicative and never an internal cost (security.md), and each hotel keeps a
 * `room_rate` so the B11 card always shows a per-night range. Data only; the seed logic is in the sibling file.
 */

export type VenueSeed = {
  name: string;
  venueType: "ballroom" | "lawn" | "poolside" | "rooftop" | "courtyard" | "beach" | "other";
  isIndoor: boolean;
  areaSqm: number;
  capacityBanquet: number;
  capacityReception: number;
  capacityTheatre: number;
  facilities: string[];
  description: string;
};

export type RoomSeed = {
  name: string;
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
    venues: [
      {
        name: "The Pichola Ballroom",
        venueType: "ballroom",
        isIndoor: true,
        areaSqm: 900,
        capacityBanquet: 350,
        capacityReception: 600,
        capacityTheatre: 450,
        facilities: ["Stage", "Dance floor", "Air conditioning"],
        description: "A pillarless lakeside ballroom overlooking Lake Pichola.",
      },
      {
        name: "Courtyard Lawn",
        venueType: "lawn",
        isIndoor: false,
        areaSqm: 1400,
        capacityBanquet: 500,
        capacityReception: 800,
        capacityTheatre: 600,
        facilities: ["Open-air mandap", "Power backup", "Valet parking"],
        description: "A walled heritage lawn for pheras and evening receptions.",
      },
    ],
    rooms: [
      {
        name: "Lake-View Suite",
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
    venues: [
      {
        name: "Aravalli Lawn",
        venueType: "lawn",
        isIndoor: false,
        areaSqm: 700,
        capacityBanquet: 200,
        capacityReception: 350,
        capacityTheatre: 260,
        facilities: ["Open-air mandap", "Power backup"],
        description: "A terraced garden lawn set against the Aravalli hills.",
      },
      {
        name: "Terrace Deck",
        venueType: "rooftop",
        isIndoor: false,
        areaSqm: 300,
        capacityBanquet: 120,
        capacityReception: 200,
        capacityTheatre: 150,
        facilities: ["Sunset view", "Bar counter"],
        description: "An intimate rooftop for sangeet and cocktail evenings.",
      },
    ],
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
    venues: [
      {
        name: "Sheesh Mahal Ballroom",
        venueType: "ballroom",
        isIndoor: true,
        areaSqm: 1100,
        capacityBanquet: 400,
        capacityReception: 700,
        capacityTheatre: 520,
        facilities: ["Mirror-work hall", "Stage", "Air conditioning"],
        description: "A restored mirror-work hall for grand indoor functions.",
      },
      {
        name: "Mughal Garden Lawn",
        venueType: "lawn",
        isIndoor: false,
        areaSqm: 2000,
        capacityBanquet: 700,
        capacityReception: 1100,
        capacityTheatre: 850,
        facilities: ["Char-bagh layout", "Fountain", "Valet parking"],
        description: "A formal Mughal-style garden for large baraats and receptions.",
      },
    ],
    rooms: [
      {
        name: "Palace Suite",
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
    venues: [
      {
        name: "Beachfront Deck",
        venueType: "beach",
        isIndoor: false,
        areaSqm: 1000,
        capacityBanquet: 250,
        capacityReception: 500,
        capacityTheatre: 350,
        facilities: ["Sea-facing stage", "Sand setup", "Power backup"],
        description: "A beachfront deck for sunset pheras and receptions.",
      },
      {
        name: "Sunset Lawn",
        venueType: "lawn",
        isIndoor: false,
        areaSqm: 1200,
        capacityBanquet: 300,
        capacityReception: 550,
        capacityTheatre: 420,
        facilities: ["Open-air mandap", "Bar counter", "Valet parking"],
        description: "A palm-lined lawn a step back from the beach.",
      },
    ],
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
