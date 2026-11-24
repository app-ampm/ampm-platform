import type { HotelFieldKinds } from "../hotel-change-set.js";
import type { HotelAreaPair } from "../hotel-units.js";

import type { HotelImportColumn } from "./hotel-import.js";
import type { RoomImportColumn, VenueImportColumn } from "./hotel-import-rooms-venues.js";

/*
 * What each kind of staff import compares (D-181; docs/planning/hotel-information-form-plan.md §4.8):
 * the fields `fieldChanges` checks for a row's changes, and the fields the API hashes into a target's
 * version token: a room's or venue's normalised by `canonicalFieldsJson`, as its planner compares them, a
 * hotel's exactly as stored, since the hotels planner keeps Slice 2's own comparison (text trimmed only,
 * lists and links exact). Apply refuses a row whose target's token moved since the preview ("Changed since
 * preview"). The token never covers `updated_at`, which recording a verification bumps. A matched room or
 * venue keeps its stored name, so `name` is not compared; nor is the hotel's web address that keys a row.
 */

/** A hotels-template column the import compares: every one but the key and the references. */
export type HotelImportComparedField = Exclude<
  HotelImportColumn,
  "slug" | "destinationName" | "imageRef"
>;

/**
 * The hotels import's compared fields: the hotel's columns and its destination's web address (a row can
 * move the hotel). The hotels planner keeps its own comparison (Slice 2); this list is what its version
 * token covers, each value hashed exactly as stored (the internal rating and notes only for an uploader
 * who reads or writes them).
 */
export const HOTEL_IMPORT_COMPARED_FIELDS: HotelFieldKinds<HotelImportComparedField> = {
  destinationSlug: "text",
  name: "text",
  brand: "text",
  parentGroup: "text",
  nameAliases: "list",
  starCategory: "text",
  status: "enum",
  demoVisible: "boolean",
  publicShowcase: "boolean",
  address: "text",
  locality: "text",
  city: "text",
  state: "text",
  postalCode: "text",
  latitude: "number",
  longitude: "number",
  mapsUrl: "url",
  streetViewRef: "text",
  website: "url",
  descriptionClient: "text",
  totalRooms: "number",
  facilities: "list",
  airportName: "text",
  airportDistanceKm: "number",
  airportDriveMinutes: "number",
  railwayStationName: "text",
  railwayDistanceKm: "number",
  railwayDriveMinutes: "number",
  cityCentreDistanceKm: "number",
  cityCentreDriveMinutes: "number",
  accessNotes: "text",
  totalEventSpaceSqm: "number",
  totalEventSpaceSqft: "number",
  weddingBuyoutPolicy: "enum",
  minRoomsWithoutBuyout: "number",
  minNights: "number",
  parallelFunctions: "enum",
  bookingNotes: "text",
  cuisines: "list",
  isPureVegetarian: "boolean",
  hasSeparateVegKitchen: "boolean",
  servesAlcohol: "boolean",
  internalRating: "number",
  internalNotes: "text",
};

/** A Rooms-template column the import compares: every one but the hotel's web address and the name. */
export type RoomImportComparedField = Exclude<RoomImportColumn, "hotelSlug" | "name">;

/** The rooms import's compared fields, each with its kind. */
export const ROOM_IMPORT_COMPARED_FIELDS: HotelFieldKinds<RoomImportComparedField> = {
  roomCount: "number",
  unitType: "enum",
  viewLabel: "text",
  bedConfiguration: "text",
  maxOccupancy: "number",
  sizeSqm: "number",
  sizeSqft: "number",
  facilities: "list",
  description: "text",
};

/** A Venues-template column the import compares: every one but the hotel's web address and the name. */
export type VenueImportComparedField = Exclude<VenueImportColumn, "hotelSlug" | "name">;

/**
 * The venues import's compared fields, each with its kind. A venue saved before Slice 3 has no stored
 * setting: compare and hash it as the staff view reads it (`venueSettingOf`: indoor when `is_indoor`,
 * else outdoor).
 */
export const VENUE_IMPORT_COMPARED_FIELDS: HotelFieldKinds<VenueImportComparedField> = {
  venueType: "enum",
  setting: "enum",
  areaSqm: "number",
  areaSqft: "number",
  lengthM: "number",
  widthM: "number",
  ceilingHeightM: "number",
  capacityBanquet: "number",
  capacityTheatre: "number",
  capacityReception: "number",
  otherLayouts: "entries",
  prefunctionAreaSqm: "number",
  prefunctionAreaSqft: "number",
  capacityNotes: "text",
  facilities: "list",
  description: "text",
};

/** A hotel's area pair, the total event space, for the units rule (`areaWrite`, `fieldChanges`). */
export const HOTEL_AREA_PAIRS: readonly HotelAreaPair<HotelImportComparedField>[] = [
  { sqm: "totalEventSpaceSqm", sqft: "totalEventSpaceSqft" },
];

/** A room's area pair, its size, for the units rule. */
export const ROOM_AREA_PAIRS: readonly HotelAreaPair<RoomImportComparedField>[] = [
  { sqm: "sizeSqm", sqft: "sizeSqft" },
];

/** A venue's area pairs, its area and its pre-function area, for the units rule. */
export const VENUE_AREA_PAIRS: readonly HotelAreaPair<VenueImportComparedField>[] = [
  { sqm: "areaSqm", sqft: "areaSqft" },
  { sqm: "prefunctionAreaSqm", sqft: "prefunctionAreaSqft" },
];
