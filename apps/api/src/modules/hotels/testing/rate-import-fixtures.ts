import type { ImportRateCardRow, ImportRateItemRow } from "../hotel-import.repository.js";
import { HOTEL_ID } from "./staff-hotel-fixtures.js";
import { CARD_ID, CARD_NAME, ITEM_ID } from "./rate-plan-fixtures.js";
import { decimal, ROOM_ID } from "./subresource-fixtures.js";

/*
 * Synthetic rate cards and items as the import's repository reads them (Decimal amounts in rupees, dates
 * as Date), for the rates import's unit specs (data.md: fictitious names and amounts). Test-only: the
 * build leaves `testing/` folders out.
 */

/**
 * A stored room rate of 12,500 to 15,000 rupees a night for the synthetic suite, unless overridden.
 *
 * @example
 * rateItemRow({ amount: decimal("13000.00") });
 */
export function rateItemRow(overrides: Partial<ImportRateItemRow> = {}): ImportRateItemRow {
  return {
    id: ITEM_ID,
    itemType: "room_rate",
    roomCategoryId: ROOM_ID,
    venueId: null,
    amount: decimal("12500.00"),
    amountMax: decimal("15000.00"),
    unit: "per_night",
    minQuantity: null,
    isIndicative: true,
    inclusionsText: "Breakfast for two",
    ...overrides,
  };
}

/**
 * A stored draft card of the synthetic hotel for 2027-28, holding the one stored item unless overridden.
 *
 * @example
 * rateCardRow({ status: "verified" });
 */
export function rateCardRow(overrides: Partial<ImportRateCardRow> = {}): ImportRateCardRow {
  return {
    id: CARD_ID,
    hotelId: HOTEL_ID,
    name: CARD_NAME,
    status: "draft",
    validFrom: new Date("2027-04-01T00:00:00.000Z"),
    validTo: new Date("2028-03-31T00:00:00.000Z"),
    items: [rateItemRow()],
    ...overrides,
  };
}
