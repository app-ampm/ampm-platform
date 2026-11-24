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
 * preview"). Each token is SHA-256 of the target's import-compared fields, read as the staff views read
 * them (a decimal as a number, a venue's setting through `venueSettingOf`), never `updated_at`, which
 * recording a verification moves without changing a field. A token is as fine as its kind's planner, so
 * two targets with one token always plan alike: a room's or venue's fields are normalised by core
 * `canonicalFieldsJson`, as its planner's `fieldChanges` normalises them; a hotel's are hashed exactly as
 * stored, since the hotels planner (Slice 2's `sameValue`) trims text only and compares lists and links
 * exactly, so an edit in spacing or in a link's case must move its token too.
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
 * What a hotel's token covers for one uploader: its internal rating and notes only when they read or
 * write them. For anyone else a notes cell is refused whatever it holds, so the notes guard nothing of
 * theirs, and a token that moved with them would tell them the notes changed (D-171).
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
 * A stored hotel's version token for one uploader: its compared fields exactly as stored, the notes only
 * within `scope`. A preview and its import compute it the same way, so only a stored change moves it (or
 * a change in what the uploader may read or write, which refuses their row as changed: never a write).
 *
 * @example
 * const scope = { notes: grants.readsNotes || grants.canWriteNotes };
 * const versions = new Map(liveHotels.map((hotel) => [hotel.id, hotelVersion(hotel, scope)]));
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

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
