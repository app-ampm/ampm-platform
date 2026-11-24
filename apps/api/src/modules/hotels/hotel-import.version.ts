import { createHash } from "node:crypto";

import {
  canonicalFieldsJson,
  HOTEL_IMPORT_COMPARED_FIELDS,
  ROOM_IMPORT_COMPARED_FIELDS,
  VENUE_IMPORT_COMPARED_FIELDS,
  type HotelFieldKinds,
  type HotelFieldValues,
  type HotelImportComparedField,
} from "@ampm/core";

import type { ImportTargetRow } from "./hotel-import.repository.js";
import type { RoomRow, VenueRow } from "./hotel-subresources.repository.js";
import { toHotelStaffView, toRoomCategoryView, toVenueView } from "./hotels-admin.view.js";

/*
 * Version tokens of an import's targets (D-181): what a preview stores for each hotel, room or venue a row
 * plans to change or leave, so its import can refuse a row whose target changed since ("Changed since
 * preview"). The token is SHA-256 of the target's import-compared fields as core `canonicalFieldsJson`
 * normalises them, read as the staff views read them (a decimal as a number, a venue's setting through
 * `venueSettingOf`), never `updated_at`, which recording a verification moves without changing a field.
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
  return createHash("sha256").update(canonicalFieldsJson(values, fields)).digest("hex");
}

/**
 * A stored hotel's compared values, whatever the uploader reads: its profile, its internal rating and
 * notes, and its destination's web address (a row can move it).
 *
 * @example
 * fieldChanges(hotelComparedValues(row), incoming, HOTEL_IMPORT_COMPARED_FIELDS);
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
 * A stored hotel's version token.
 *
 * @example
 * const versions = new Map(liveHotels.map((hotel) => [hotel.id, hotelVersion(hotel)]));
 */
export function hotelVersion(row: ImportTargetRow): string {
  return versionOf(hotelComparedValues(row), HOTEL_IMPORT_COMPARED_FIELDS);
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
