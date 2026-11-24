import type { RateImportRow } from "@ampm/core";

import type { RateImportGrants } from "../hotel-audience.js";
import {
  planRateRows,
  type RateItemRef,
  type RateItemValues,
  type RatePlanContext,
  type RateRowPlan,
  type StoredRateCard,
  type StoredRateItem,
} from "../hotel-import.rates-plan.js";
import { HOTEL_ID } from "./staff-hotel-fixtures.js";
import { ROOM_ID, VENUE_ID } from "./subresource-fixtures.js";

/*
 * Synthetic rate cards, items, rooms and venues as the rates planner reads them, for its unit specs
 * (data.md: fictitious names and amounts). Test-only: the build leaves `testing/` folders out.
 */

export const LAKE = "synthetic-lake-hotel";
export const GONE = "synthetic-gone-hotel";
export const GONE_ID = "0192f1a0-0000-7000-8000-0000000000b9";
export const CARD_ID = "0192f1a0-0000-7000-8000-0000000000c1";
export const OTHER_CARD_ID = "0192f1a0-0000-7000-8000-0000000000c2";
export const ITEM_ID = "0192f1a0-0000-7000-8000-0000000000c3";
export const OTHER_ITEM_ID = "0192f1a0-0000-7000-8000-0000000000c4";
export const CARD_NAME = "Synthetic season 2027";
export const ROOM_NAME = "Synthetic Lake Suite";
export const VENUE_NAME = "Synthetic Lawn";

/** Every rates key: what the Hotel team and the Super Admin hold. */
export const ALL_RATE_GRANTS: RateImportGrants = {
  canCreate: true,
  canUpdate: true,
  readsCards: true,
  readsRoomsVenues: true,
};

/** Money as a row carries it, from rupees. */
export const rupees = (amount: number) => ({ minor: amount * 100, currency: "INR" as const });

/**
 * A stored room rate of 12,500 to 15,000 rupees a night for the synthetic suite, unless overridden.
 *
 * @example
 * storedItem({ values: { amount: 1_300_000 } });
 */
export function storedItem(
  overrides: Partial<Omit<StoredRateItem, "values">> & { values?: Partial<RateItemValues> } = {},
): StoredRateItem {
  const { values, ...item } = overrides;
  return {
    id: ITEM_ID,
    itemType: "room_rate",
    roomCategoryId: ROOM_ID,
    venueId: null,
    values: {
      amount: 1_250_000,
      amountMax: 1_500_000,
      unit: "per_night",
      minQuantity: null,
      isIndicative: true,
      inclusions: "Breakfast for two",
      ...values,
    },
    ...item,
  };
}

/** A stored draft card of the synthetic hotel, holding the one stored item unless overridden. */
export function storedCard(overrides: Partial<StoredRateCard> = {}): StoredRateCard {
  return {
    id: CARD_ID,
    name: CARD_NAME,
    status: "draft",
    validFrom: "2027-04-01",
    validTo: "2028-03-31",
    items: [storedItem()],
    ...overrides,
  };
}

/** What the rates planner reads: the live synthetic hotel and a deleted one, their cards, rooms and venues. */
export function rateContext(
  options: {
    readonly cards?: readonly StoredRateCard[];
    readonly rooms?: readonly RateItemRef[];
    readonly venues?: readonly RateItemRef[];
    readonly grants?: Partial<RateImportGrants>;
  } = {},
): RatePlanContext {
  return {
    hotels: new Map([
      [LAKE, { id: HOTEL_ID, deletedAt: null }],
      [GONE, { id: GONE_ID, deletedAt: new Date("2026-11-01T00:00:00.000Z") }],
    ]),
    cards: new Map([[HOTEL_ID, options.cards ?? [storedCard()]]]),
    rooms: new Map([[HOTEL_ID, options.rooms ?? [{ id: ROOM_ID, name: ROOM_NAME }]]]),
    venues: new Map([[HOTEL_ID, options.venues ?? [{ id: VENUE_ID, name: VENUE_NAME }]]]),
    grants: { ...ALL_RATE_GRANTS, ...options.grants },
  };
}

/**
 * Plans rows of the synthetic hotel's card, from line 2, each a room rate unless its cells say otherwise.
 *
 * @example
 * const [plan] = planRates([{ roomName: ROOM_NAME, amount: rupees(13_000) }]);
 */
export function planRates(
  cells: readonly Partial<RateImportRow>[],
  context: RatePlanContext = rateContext(),
): RateRowPlan[] {
  const rows = cells.map((cell, index) => ({
    line: index + 2,
    row: { hotelSlug: LAKE, cardName: CARD_NAME, itemType: "room_rate" as const, ...cell },
  }));
  return planRateRows(rows, context);
}
