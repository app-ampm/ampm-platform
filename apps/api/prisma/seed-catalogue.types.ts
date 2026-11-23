/*
 * The shape of the starter hotel catalogue (D-159): real wedding hotels with rough, public-source details
 * that the Hotel team corrects in the hotel admin later. Amounts are rupees (the Decimal(14,2) columns);
 * a `Range` is an indicative low..high (Q9). Types only; the data is in the seed-catalogue.*.data.ts files.
 */

/** An indicative rupee range, low then high (Q9). */
export type Range = readonly [number, number];

export type CatalogueDestination = {
  slug: string;
  name: string;
  region: string;
  state: string;
  description: string;
};

export type CatalogueRoom = {
  name: string;
  roomCount: number;
  maxOccupancy: number;
  sizeSqm: number;
  facilities: string[];
  description: string;
  /** This season's per-night range (the client-visible rate card). */
  rate: Range;
  /** Next season's per-night range (the draft card, staff only until it is verified). */
  nextRate: Range;
};

export type CatalogueVenue = {
  name: string;
  venueType: "ballroom" | "lawn" | "poolside" | "rooftop" | "courtyard" | "beach" | "other";
  isIndoor: boolean;
  areaSqm: number;
  capacityBanquet: number;
  capacityReception: number;
  capacityTheatre: number;
  facilities: string[];
  description: string;
  /** The venue rental range for one function. */
  rental: Range;
};

/** The non-room, non-venue lines of this season's rate card. */
export type CatalogueRates = {
  vegPlate: Range;
  nonVegPlate: Range;
  /** The minimum covers for a per-plate menu. */
  minCovers: number;
  weddingPackage: Range;
  /** Per guest, for the evening bar. */
  beveragePackage: Range;
  /** Staff-only: what the hotel adds on the total, as a percentage. */
  serviceChargePercent: number;
  /** Late-night music extension past the local curfew, per function. */
  lateNightMusic: Range;
  nextWeddingPackage: Range;
};

export type CatalogueHotel = {
  slug: string;
  name: string;
  destination: string;
  brand: string;
  starCategory: string;
  totalRooms: number;
  address: string;
  latitude: string;
  longitude: string;
  website: string;
  descriptionClient: string;
  facilities: string[];
  internalRating: number;
  rooms: CatalogueRoom[];
  venues: CatalogueVenue[];
  rates: CatalogueRates;
};
