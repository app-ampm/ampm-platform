import { z } from "zod";

import { hotelVenueSetting } from "./hotel-rooms-venues.js";
import { hotelVenueType } from "./hotels.js";
import { catalogueSlug, roomCategoryRequestFields, venueRequestFields } from "./hotels-admin.js";

/*
 * The Rooms and Venues templates of the staff import (TW-25; D-178, D-181; docs/planning/
 * hotel-information-form-plan.md §4.8, Slice 3). A row names its hotel by web address (`hotelSlug`) and
 * matches the hotel's live room or venue by name, exactly once normalised; no match creates one. A
 * matched row keeps its stored name, and an import never deletes or recreates a row, because rate items
 * point at rooms and venues. On an update a blank cell leaves the value unchanged. The row schemas take
 * already-typed values (the API's reader types each cell and leaves blank cells out), so a stored
 * preview's rows parse again with the same schema at apply.
 */

/** The Rooms template's columns, in template order. A file may carry any of them; an unknown header is refused. */
export const ROOM_IMPORT_COLUMNS = [
  "hotelSlug",
  "name",
  "roomCount",
  "unitType",
  "viewLabel",
  "bedConfiguration",
  "maxOccupancy",
  "sizeSqm",
  "sizeSqft",
  "facilities",
  "description",
] as const;
export const roomImportColumn = z.enum(ROOM_IMPORT_COLUMNS);
export type RoomImportColumn = z.infer<typeof roomImportColumn>;

/** The columns every Rooms file must carry. */
export const ROOM_IMPORT_REQUIRED_COLUMNS = [
  "hotelSlug",
  "name",
] as const satisfies readonly RoomImportColumn[];

/** Rooms columns whose cells are numbers. */
export const ROOM_IMPORT_NUMBER_COLUMNS = [
  "roomCount",
  "maxOccupancy",
  "sizeSqm",
  "sizeSqft",
] as const satisfies readonly RoomImportColumn[];

/** Rooms columns whose cells are true or false: none. */
export const ROOM_IMPORT_BOOLEAN_COLUMNS = [] as const satisfies readonly RoomImportColumn[];

/** Rooms columns whose cells are lists (`hotelListEntries`). */
export const ROOM_IMPORT_LIST_COLUMNS = [
  "facilities",
] as const satisfies readonly RoomImportColumn[];

/** Rooms columns whose cells name an enum value (`hotelImportEnumValue`). */
export const ROOM_IMPORT_ENUM_COLUMNS = ["unitType"] as const satisfies readonly RoomImportColumn[];

/**
 * One parsed row of the Rooms template: the hotel's web address and the staff room fields, so the bounds
 * are the staff sheet's.
 *
 * @example
 * roomImportRow.parse({ hotelSlug: "synthetic-lake-hotel", name: "Lake View Suite", sizeSqft: 650 });
 */
export const roomImportRow = z
  .object({ hotelSlug: catalogueSlug, ...roomCategoryRequestFields })
  .strict();
export type RoomImportRow = z.infer<typeof roomImportRow>;

/** The Venues template's columns, in template order. */
export const VENUE_IMPORT_COLUMNS = [
  "hotelSlug",
  "name",
  "venueType",
  "setting",
  "areaSqm",
  "areaSqft",
  "lengthM",
  "widthM",
  "ceilingHeightM",
  "capacityBanquet",
  "capacityTheatre",
  "capacityReception",
  "otherLayouts",
  "prefunctionAreaSqm",
  "prefunctionAreaSqft",
  "capacityNotes",
  "facilities",
  "description",
] as const;
export const venueImportColumn = z.enum(VENUE_IMPORT_COLUMNS);
export type VenueImportColumn = z.infer<typeof venueImportColumn>;

/** The columns every Venues file must carry. A new venue needs `venueType` and `setting` too (a row error). */
export const VENUE_IMPORT_REQUIRED_COLUMNS = [
  "hotelSlug",
  "name",
] as const satisfies readonly VenueImportColumn[];

/** Venues columns whose cells are numbers. */
export const VENUE_IMPORT_NUMBER_COLUMNS = [
  "areaSqm",
  "areaSqft",
  "lengthM",
  "widthM",
  "ceilingHeightM",
  "capacityBanquet",
  "capacityTheatre",
  "capacityReception",
  "prefunctionAreaSqm",
  "prefunctionAreaSqft",
] as const satisfies readonly VenueImportColumn[];

/** Venues columns whose cells are true or false: none. */
export const VENUE_IMPORT_BOOLEAN_COLUMNS = [] as const satisfies readonly VenueImportColumn[];

/** Venues columns whose cells are lists (`hotelListEntries`). */
export const VENUE_IMPORT_LIST_COLUMNS = [
  "facilities",
] as const satisfies readonly VenueImportColumn[];

/** Venues columns whose cells name an enum value (`hotelImportEnumValue`). */
export const VENUE_IMPORT_ENUM_COLUMNS = [
  "venueType",
  "setting",
] as const satisfies readonly VenueImportColumn[];

/** Venues columns whose cells are other layouts (`parseVenueLayoutsCell`). */
export const VENUE_IMPORT_LAYOUT_COLUMNS = [
  "otherLayouts",
] as const satisfies readonly VenueImportColumn[];

/**
 * Venues number columns that hold a capacity: one number each, so a range is refused with
 * `VENUE_CAPACITY_RANGE_MESSAGE` (the range goes in `capacityNotes`).
 */
export const VENUE_IMPORT_CAPACITY_COLUMNS = [
  "capacityBanquet",
  "capacityTheatre",
  "capacityReception",
] as const satisfies readonly VenueImportColumn[];

/**
 * One parsed row of the Venues template: the hotel's web address and the staff venue fields, with
 * `venueType` and `setting` optional here because an update may leave them; the API refuses a row that
 * would create a venue without them (a row error, never a database error). No `isIndoor` column: the
 * API derives it from the setting.
 *
 * @example
 * venueImportRow.parse({ hotelSlug: "synthetic-lake-hotel", name: "Synthetic Lawn", venueType: "lawn", setting: "outdoor" });
 */
export const venueImportRow = z
  .object({
    hotelSlug: catalogueSlug,
    ...venueRequestFields,
    venueType: hotelVenueType.optional(),
    setting: hotelVenueSetting.optional(),
  })
  .strict();
export type VenueImportRow = z.infer<typeof venueImportRow>;
