import type { Prisma } from "../src/generated/prisma/client.js";
import { CATALOGUE_GST_PERCENT } from "./seed-catalogue.data.js";
import type { CatalogueHotel, CatalogueRates, Range } from "./seed-catalogue.types.js";

/*
 * Pure builders for the starter catalogue's rate lines and map link (D-159); the writes are in
 * seed-catalogue.ts. This season's card prices every room and venue and then every other rate-item type
 * once, so a hotel shows each kind of line; all are indicative (Q9) and client-visible except the service
 * charge, which stays staff-only to show a hidden line on a verified card.
 */

export type ItemInput = Prisma.HotelRateItemCreateManyRateCardInput;

type ExtraLine = {
  itemType: ItemInput["itemType"];
  unit: ItemInput["unit"];
  /** The range, or a single value (a percentage with no upper bound). */
  pick: (rates: CatalogueRates) => Range | number;
  inclusionsText: string;
  hasMinCovers?: boolean;
  isStaffOnly?: boolean;
};

const EXTRA_LINES: readonly ExtraLine[] = [
  {
    itemType: "per_plate_veg",
    unit: "per_plate",
    pick: (rates) => rates.vegPlate,
    inclusionsText: "Vegetarian buffet with live counters; taxes extra.",
    hasMinCovers: true,
  },
  {
    itemType: "per_plate_non_veg",
    unit: "per_plate",
    pick: (rates) => rates.nonVegPlate,
    inclusionsText: "Non-vegetarian buffet with live counters; taxes extra.",
    hasMinCovers: true,
  },
  {
    itemType: "wedding_package",
    unit: "per_event",
    pick: (rates) => rates.weddingPackage,
    inclusionsText:
      "Two-day wedding: venues, base décor and lighting, and the couple's suite; food, drinks and " +
      "guest rooms extra.",
  },
  {
    itemType: "beverage_package",
    unit: "per_plate",
    pick: (rates) => rates.beveragePackage,
    inclusionsText: "Per guest: an evening bar of spirits, wine and beer.",
  },
  {
    itemType: "service_charge",
    unit: "percent",
    pick: (rates) => rates.serviceChargePercent,
    inclusionsText: "On the food and beverage bill.",
    isStaffOnly: true,
  },
  {
    itemType: "tax",
    unit: "percent",
    pick: () => CATALOGUE_GST_PERCENT,
    inclusionsText: "GST on rooms and banqueting, by item and room tariff.",
  },
  {
    itemType: "other",
    unit: "per_event",
    pick: (rates) => rates.lateNightMusic,
    inclusionsText:
      "Late-night music extension past the local curfew, per function, where permitted.",
  },
];

/** Rupee amounts for the Decimal(14,2) columns: a range, or a single value with no upper bound. */
function amounts(value: Range | number): Pick<ItemInput, "amount" | "amountMax"> {
  return typeof value === "number"
    ? { amount: value, amountMax: null }
    : { amount: value[0], amountMax: value[1] };
}

/** A room's per-night line, tied to its category; `isNext` reads next season's range (staff only). */
function roomLine(
  hotel: CatalogueHotel,
  index: number,
  roomId: string,
  isNext: boolean,
): ItemInput {
  const room = hotel.rooms[index];
  if (!room) throw new Error(`${hotel.slug} has no room ${index}`);
  return {
    itemType: "room_rate",
    unit: "per_night",
    ...amounts(isNext ? room.nextRate : room.rate),
    roomCategoryId: roomId,
    isIndicative: true,
    clientVisible: !isNext,
    inclusionsText: `${room.name} with breakfast for two; taxes extra.`,
  };
}

/**
 * This season's lines: a room rate per room category, a rental per venue, then every other type once.
 * `roomIds` and `venueIds` are the created rows' ids, in the data's order.
 */
export function seasonItems(
  hotel: CatalogueHotel,
  roomIds: readonly string[],
  venueIds: readonly string[],
): ItemInput[] {
  const rooms = roomIds.map((roomId, index) => roomLine(hotel, index, roomId, false));
  const venues = hotel.venues.map((venue, index): ItemInput => ({
    itemType: "venue_rental",
    unit: "per_event",
    ...amounts(venue.rental),
    venueId: venueIds[index] ?? null,
    isIndicative: true,
    clientVisible: true,
    inclusionsText: `${venue.name} for one function, with base lighting.`,
  }));
  const extras = EXTRA_LINES.map((line): ItemInput => ({
    itemType: line.itemType,
    unit: line.unit,
    ...amounts(line.pick(hotel.rates)),
    minQuantity: line.hasMinCovers ? hotel.rates.minCovers : null,
    isIndicative: true,
    clientVisible: !line.isStaffOnly,
    inclusionsText: line.inclusionsText,
  }));
  return [...rooms, ...venues, ...extras];
}

/** Next season's draft lines (staff only until the card is verified): the room rates and the package. */
export function nextSeasonItems(hotel: CatalogueHotel, roomIds: readonly string[]): ItemInput[] {
  const rooms = roomIds.map((roomId, index) => roomLine(hotel, index, roomId, true));
  const pkg: ItemInput = {
    itemType: "wedding_package",
    unit: "per_event",
    ...amounts(hotel.rates.nextWeddingPackage),
    isIndicative: true,
    clientVisible: false,
    inclusionsText: "Two-day wedding, next season.",
  };
  return [...rooms, pkg];
}

/** A Google Maps search link for the hotel, which the client's map action opens as given. */
export function mapsLink(hotel: CatalogueHotel): string {
  const query = encodeURIComponent(`${hotel.name}, ${hotel.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
