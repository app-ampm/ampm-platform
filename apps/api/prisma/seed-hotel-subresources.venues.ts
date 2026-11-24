import type { HotelVenueSetting, HotelVenueType } from "@ampm/core";

/*
 * Module C demo depth (data.md: synthetic only) — the venues of the four seeded hotels, by hotel. Each
 * states its setting (D-178); the seed writes `is_indoor` from it, as the service does: true only for
 * indoor. The capacities mean (decision 11): banquet seated at round tables, reception floating, theatre
 * rows of chairs. Data only; the seed logic is in seed-hotel-subresources.ts.
 */

export type VenueSeed = {
  name: string;
  venueType: HotelVenueType;
  setting: HotelVenueSetting;
  areaSqm: number;
  capacityBanquet: number;
  capacityReception: number;
  capacityTheatre: number;
  facilities: string[];
  description: string;
};

/** The seeded hotels that carry venues. */
type SeedHotelSlug =
  "lake-pavilion-udaipur" | "aravalli-retreat-udaipur" | "rose-fort-jaipur" | "candolim-sands-goa";

/** Each seeded hotel's venues. */
export const SEED_VENUES: Readonly<Record<SeedHotelSlug, VenueSeed[]>> = {
  "lake-pavilion-udaipur": [
    {
      name: "The Pichola Ballroom",
      venueType: "ballroom",
      setting: "indoor",
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
      setting: "outdoor",
      areaSqm: 1400,
      capacityBanquet: 500,
      capacityReception: 800,
      capacityTheatre: 600,
      facilities: ["Open-air mandap", "Power backup", "Valet parking"],
      description: "A walled heritage lawn for pheras and evening receptions.",
    },
  ],
  "aravalli-retreat-udaipur": [
    {
      name: "Aravalli Lawn",
      venueType: "lawn",
      setting: "outdoor",
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
      setting: "semi_open",
      areaSqm: 300,
      capacityBanquet: 120,
      capacityReception: 200,
      capacityTheatre: 150,
      facilities: ["Sunset view", "Bar counter"],
      description: "An intimate rooftop for sangeet and cocktail evenings.",
    },
  ],
  "rose-fort-jaipur": [
    {
      name: "Sheesh Mahal Ballroom",
      venueType: "ballroom",
      setting: "indoor",
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
      setting: "outdoor",
      areaSqm: 2000,
      capacityBanquet: 700,
      capacityReception: 1100,
      capacityTheatre: 850,
      facilities: ["Char-bagh layout", "Fountain", "Valet parking"],
      description: "A formal Mughal-style garden for large baraats and receptions.",
    },
  ],
  "candolim-sands-goa": [
    {
      name: "Beachfront Deck",
      venueType: "beach",
      setting: "outdoor",
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
      setting: "outdoor",
      areaSqm: 1200,
      capacityBanquet: 300,
      capacityReception: 550,
      capacityTheatre: 420,
      facilities: ["Open-air mandap", "Bar counter", "Valet parking"],
      description: "A palm-lined lawn a step back from the beach.",
    },
  ],
};
