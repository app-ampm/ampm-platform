import { createHash } from "node:crypto";

import {
  canonicalFieldsJson,
  HOTEL_IMPORT_COMPARED_FIELDS,
  RATE_IMPORT_COMPARED_FIELDS,
  ROOM_IMPORT_COMPARED_FIELDS,
  VENUE_IMPORT_COMPARED_FIELDS,
  type HotelFieldKinds,
  type HotelFieldValues,
  type HotelImportComparedField,
} from "@ampm/core";

import type { RateItemValues } from "./hotel-import.rates-plan.js";
import type {
  ImportRateCardRow,
  ImportRateItemRow,
  ImportTargetRow,
} from "./hotel-import.repository.js";
import { decimalToMoney } from "./hotel-rates.money.js";
import { toDateString } from "./hotel-rates.view.js";
import type { RoomRow, VenueRow } from "./hotel-subresources.repository.js";
import { toHotelStaffView, toRoomCategoryView, toVenueView } from "./hotels-admin.view.js";

/*
 * Version tokens of an import's targets (D-181, D-183, D-184): what a preview stores for each hotel,
 * room, venue or rate item a row plans to change or leave, and each rate card a row plans to add an item
 * to, so its import can refuse a row whose target changed since ("Changed since preview"). Each token is
 * SHA-256 of the target's import-compared fields, read as the staff views read them (a decimal as a
 * number, an amount in paise, a venue's setting through `venueSettingOf`), never `updated_at`, which
 * recording a verification moves without changing a field. A token is as fine as its kind's planner, so
 * two targets with one token always plan alike: a room's, venue's or rate item's fields are normalised by
 * core `canonicalFieldsJson`, as its planner's `fieldChanges` normalises them; a hotel's are hashed
 * exactly as stored, since the hotels planner (Slice 2's `sameValue`) trims text only and compares lists
 * and links exactly, so an edit in spacing or in a link's case must move its token too. A rate card's
 * covers what decides whether rows may go into it: its status and its dates.
 */

/**
 * The version token of a record's compared fields.
 *
 * @example
 * versionOf(toRoomCategoryView(row), ROOM_IMPORT_COMPARED_FIELDS); // "9f86d081…" (64 hex digits)
 */
export function versionOf<K extends string>(
  values: HotelFieldValues<NoInfer<K>>,
  fields: HotelFieldKinds<K>,
): string {
  return sha256(canonicalFieldsJson(values, fields));
}

/**
 * What a hotel's token covers for one row of one uploader: its internal rating and notes only when the
 * uploader reads them, or the row fills a notes cell (and may write over them). For any other row the
 * notes guard nothing, and a token that moved with them would tell an uploader who cannot read them that
 * they changed (D-171).
 */
export interface HotelVersionScope {
  readonly notes: boolean;
}

const NOTES = new Set<HotelImportComparedField>(["internalRating", "internalNotes"]);

const HOTEL_FIELDS = Object.keys(HOTEL_IMPORT_COMPARED_FIELDS).filter(
  (key): key is HotelImportComparedField => key in HOTEL_IMPORT_COMPARED_FIELDS,
);

/**
 * A stored hotel's compared values: its profile, its internal rating and notes, and its destination's web
 * address (a row can move it).
 *
 * @example
 * hotelComparedValues(row).destinationSlug; // "synthetic-destination"
 */
export function hotelComparedValues(
  row: ImportTargetRow,
): HotelFieldValues<HotelImportComparedField> {
  return {
    ...toHotelStaffView(row),
    internalRating: row.internalRating,
    internalNotes: row.internalNotes,
    destinationSlug: row.destination.slug,
  };
}

/**
 * A stored hotel's version token for one row of one uploader: its compared fields exactly as stored, the
 * notes only within `scope`. A preview and its import compute it the same way, so only a stored change
 * moves it (or a change in what the uploader may read, which refuses their row as changed: never a write).
 *
 * @example
 * const scope = { notes: grants.readsNotes || row.internalNotes !== undefined || row.internalRating !== undefined };
 * versions.set(hotel.id, hotelVersion(hotel, scope));
 */
export function hotelVersion(row: ImportTargetRow, scope: HotelVersionScope): string {
  const values = hotelComparedValues(row);
  const fields = HOTEL_FIELDS.filter((field) => scope.notes || !NOTES.has(field));
  return sha256(JSON.stringify(fields.map((field) => [field, values[field] ?? null])));
}

/**
 * A stored room category's version token.
 *
 * @example
 * roomVersion(row) === stored.target.version; // the room holds what its preview planned against
 */
export function roomVersion(row: RoomRow): string {
  return versionOf(toRoomCategoryView(row), ROOM_IMPORT_COMPARED_FIELDS);
}

/**
 * A stored venue's version token: its setting as the staff view reads it, its metres as numbers.
 *
 * @example
 * venueVersion(row) === stored.target.version; // the venue holds what its preview planned against
 */
export function venueVersion(row: VenueRow): string {
  return versionOf(toVenueView(row), VENUE_IMPORT_COMPARED_FIELDS);
}

/**
 * A stored rate item's compared values, its amounts in whole paise: what the rates planner compares and
 * what its token covers.
 *
 * @example
 * rateItemValuesOf(row).amount; // 1250000 for 12,500.00 rupees
 */
export function rateItemValuesOf(row: ImportRateItemRow): RateItemValues {
  return {
    amount: decimalToMoney(row.amount).minor,
    amountMax: row.amountMax === null ? null : decimalToMoney(row.amountMax).minor,
    unit: row.unit,
    minQuantity: row.minQuantity,
    isIndicative: row.isIndicative,
    inclusions: row.inclusionsText,
  };
}

/**
 * A stored rate item's version token: its price and terms, never its visibility, which an import never
 * changes.
 *
 * @example
 * rateItemVersion(row) === stored.target.version; // the item holds what its preview planned against
 */
export function rateItemVersion(row: ImportRateItemRow): string {
  return versionOf(rateItemValuesOf(row), RATE_IMPORT_COMPARED_FIELDS);
}

const RATE_CARD_FIELDS: HotelFieldKinds<"status" | "validFrom" | "validTo"> = {
  status: "enum",
  validFrom: "text",
  validTo: "text",
};

/**
 * A stored rate card's version token: its status and its dates, which decide whether a row may add an
 * item to it. A rename moves no token: the import's re-plan matches the card by name.
 *
 * @example
 * rateCardVersion(card) === stored.target.version; // still a draft, with the same dates
 */
export function rateCardVersion(
  row: Pick<ImportRateCardRow, "status" | "validFrom" | "validTo">,
): string {
  const values = {
    status: row.status,
    validFrom: toDateString(row.validFrom),
    validTo: toDateString(row.validTo),
  };
  return versionOf(values, RATE_CARD_FIELDS);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
