import { z } from "zod";

import { storableText } from "./common.js";
import { HOTEL_IMPORT_MAX_RUPEES } from "./hotel-import-cells.js";
import { hotelRateItemType, hotelRateItemUnit } from "./hotel-rates.js";
import { catalogueSlug } from "./hotels-admin.js";

/*
 * The Rates template of the staff import (TW-25; D-170, D-181, D-184; docs/planning/
 * hotel-information-form-plan.md §4.8, Slice 4). A row names its hotel by web address and its rate card by
 * name within the hotel, and its item by type, room and venue within that card. Rates load only into
 * DRAFT cards, as hidden items: the template has no visibility, currency or restricted card column, and a
 * card is verified only in the staff app (D-170). On an update a blank cell leaves the value unchanged;
 * the card's dates are read only when the import creates the card. The row schema takes already-typed
 * values (the API's reader types each cell, an amount as whole paise, and leaves blank cells out), so a
 * stored preview's rows parse again with the same schema at apply.
 */

/** The Rates template's columns, in template order. A file may carry any of them; an unknown header is refused. */
export const RATE_IMPORT_COLUMNS = [
  "hotelSlug",
  "cardName",
  "validFrom",
  "validTo",
  "itemType",
  "roomName",
  "venueName",
  "amount",
  "amountMax",
  "unit",
  "minQuantity",
  "isIndicative",
  "inclusions",
] as const;
export const rateImportColumn = z.enum(RATE_IMPORT_COLUMNS);
export type RateImportColumn = z.infer<typeof rateImportColumn>;

/** The columns every Rates file must carry. A new item needs `amount` and `unit` too (a row error). */
export const RATE_IMPORT_REQUIRED_COLUMNS = [
  "hotelSlug",
  "cardName",
  "itemType",
] as const satisfies readonly RateImportColumn[];

/** Rates columns whose cells are numbers. */
export const RATE_IMPORT_NUMBER_COLUMNS = [
  "minQuantity",
] as const satisfies readonly RateImportColumn[];

/** Rates columns whose cells are true or false (also yes/no and 1/0). */
export const RATE_IMPORT_BOOLEAN_COLUMNS = [
  "isIndicative",
] as const satisfies readonly RateImportColumn[];

/** Rates columns whose cells are lists: none. */
export const RATE_IMPORT_LIST_COLUMNS = [] as const satisfies readonly RateImportColumn[];

/** Rates columns whose cells name an enum value (`hotelImportEnumValue`: "Room rate", "per night"). */
export const RATE_IMPORT_ENUM_COLUMNS = [
  "itemType",
  "unit",
] as const satisfies readonly RateImportColumn[];

/** Rates columns whose cells are amounts in rupees (`parseRupeesCell`). */
export const RATE_IMPORT_MONEY_COLUMNS = [
  "amount",
  "amountMax",
] as const satisfies readonly RateImportColumn[];

/** Why a row naming both a room and a venue is refused, on its `venueName`. */
export const RATE_ITEM_ROOM_OR_VENUE_MESSAGE = "An item is for a room or a venue, not both";

/** An amount as a money cell reads it: whole paise, in rupees at most {@link HOTEL_IMPORT_MAX_RUPEES}. */
const importAmount = z
  .object({
    minor: z
      .number()
      .int()
      .min(0)
      .max(HOTEL_IMPORT_MAX_RUPEES * 100),
    currency: z.literal("INR"),
  })
  .strict();

/** A card's first or last day: a real calendar date, YYYY-MM-DD. */
const cardDay = z.iso.date("Write the date as YYYY-MM-DD, such as 2027-04-01");

const rateImportFields = z
  .object({
    hotelSlug: catalogueSlug,
    cardName: z.string().trim().min(1).max(255),
    validFrom: cardDay.optional(),
    validTo: cardDay.optional(),
    itemType: hotelRateItemType,
    roomName: z.string().trim().min(1).max(255).optional(),
    venueName: z.string().trim().min(1).max(255).optional(),
    amount: importAmount.optional(),
    amountMax: importAmount.optional(),
    unit: hotelRateItemUnit.optional(),
    minQuantity: z.number().int().min(0).max(100_000).optional(),
    isIndicative: z.boolean().optional(),
    inclusions: storableText().max(10_000).optional(),
  })
  .strict();

/**
 * One parsed row of the Rates template. `amount`, `amountMax` and `unit` are optional because an update
 * may leave them; the API refuses a row that would create an item without `amount` or `unit`, and one
 * whose `amountMax` falls below its amount (the stored one, when only one of the two is filled). The row
 * itself must not end its card before it starts, nor name a room and a venue at once.
 *
 * @example
 * rateImportRow.parse({
 *   hotelSlug: "synthetic-lake-hotel",
 *   cardName: "Synthetic season 2027",
 *   itemType: "room_rate",
 *   roomName: "Lake View Suite",
 *   amount: { minor: 1250000, currency: "INR" },
 *   unit: "per_night",
 * });
 */
export const rateImportRow = rateImportFields.superRefine((row, ctx) => {
  if (row.validFrom !== undefined && row.validTo !== undefined && row.validTo < row.validFrom) {
    ctx.addIssue({
      code: "custom",
      path: ["validTo"],
      message: "validTo must not be before validFrom",
    });
  }
  if (row.roomName !== undefined && row.venueName !== undefined) {
    ctx.addIssue({ code: "custom", path: ["venueName"], message: RATE_ITEM_ROOM_OR_VENUE_MESSAGE });
  }
});
export type RateImportRow = z.infer<typeof rateImportRow>;
