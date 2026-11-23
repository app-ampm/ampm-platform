import {
  HOTEL_IMPORT_COLUMNS,
  type HotelCatalogueKey,
  type HotelImportColumn,
  type HotelUpdateRequest,
} from "@ampm/core";

import type { HotelUpdatePatch, HotelWriteData } from "./hotels-admin.repository.js";

/*
 * How a staff request or an import row becomes the columns written to `hotels` (D-178). Pure, so it tests
 * in isolation. A field left undefined is not written, because Prisma skips it: an update keeps the
 * column and a create leaves it at its default. A null clears it. The repository turns the JSON list
 * columns into what Prisma takes.
 */

/** The import columns that key a row (where the hotel goes, which hotel, its image) rather than fill one. */
type ImportKeyColumn = "destinationSlug" | "destinationName" | "slug" | "imageRef";
const IMPORT_KEY_COLUMNS = new Set<HotelImportColumn>([
  "destinationSlug",
  "destinationName",
  "slug",
  "imageRef",
]);

/** A hotel column a staff request or an import row writes (every import column that is not a key). */
export type HotelProfileKey = Exclude<HotelImportColumn, ImportKeyColumn>;

const isProfileKey = (column: HotelImportColumn): column is HotelProfileKey =>
  !IMPORT_KEY_COLUMNS.has(column);

/**
 * Every hotel column a write may set, in the import template's order, so a dry run names its changes in
 * the order of the file's columns.
 *
 * @example
 * HOTEL_PROFILE_KEYS.includes("bookingNotes"); // true
 */
export const HOTEL_PROFILE_KEYS: readonly HotelProfileKey[] =
  HOTEL_IMPORT_COLUMNS.filter(isProfileKey);

/** The profile fields of a staff create or update request, or of an import row (blank cells absent). */
export type HotelProfileFields = Partial<Pick<HotelUpdateRequest, HotelProfileKey>>;

/** The columns of the long-standing profile. */
function baseValues(fields: HotelProfileFields): HotelUpdatePatch {
  return {
    name: fields.name,
    brand: fields.brand,
    starCategory: fields.starCategory,
    address: fields.address,
    latitude: fields.latitude,
    longitude: fields.longitude,
    descriptionClient: fields.descriptionClient,
    website: fields.website,
    status: fields.status,
    demoVisible: fields.demoVisible,
    publicShowcase: fields.publicShowcase,
    internalRating: fields.internalRating,
    internalNotes: fields.internalNotes,
    totalRooms: fields.totalRooms,
    streetViewRef: fields.streetViewRef,
    facilities: fields.facilities,
  };
}

/** The D-178 columns: location and access, event space, booking terms, food. */
function catalogueValues(fields: HotelProfileFields): Pick<HotelUpdatePatch, HotelCatalogueKey> {
  return {
    parentGroup: fields.parentGroup,
    nameAliases: fields.nameAliases,
    locality: fields.locality,
    city: fields.city,
    state: fields.state,
    postalCode: fields.postalCode,
    mapsUrl: fields.mapsUrl,
    airportName: fields.airportName,
    airportDistanceKm: fields.airportDistanceKm,
    airportDriveMinutes: fields.airportDriveMinutes,
    railwayStationName: fields.railwayStationName,
    railwayDistanceKm: fields.railwayDistanceKm,
    railwayDriveMinutes: fields.railwayDriveMinutes,
    cityCentreDistanceKm: fields.cityCentreDistanceKm,
    cityCentreDriveMinutes: fields.cityCentreDriveMinutes,
    accessNotes: fields.accessNotes,
    totalEventSpaceSqm: fields.totalEventSpaceSqm,
    totalEventSpaceSqft: fields.totalEventSpaceSqft,
    weddingBuyoutPolicy: fields.weddingBuyoutPolicy,
    minRoomsWithoutBuyout: fields.minRoomsWithoutBuyout,
    minNights: fields.minNights,
    parallelFunctions: fields.parallelFunctions,
    bookingNotes: fields.bookingNotes,
    cuisines: fields.cuisines,
    isPureVegetarian: fields.isPureVegetarian,
    hasSeparateVegKitchen: fields.hasSeparateVegKitchen,
    servesAlcohol: fields.servesAlcohol,
  };
}

/** Every profile column the fields name, each as written; the ones they leave out stay undefined. */
function profileValues(fields: HotelProfileFields): HotelUpdatePatch {
  return { ...baseValues(fields), ...catalogueValues(fields) };
}

/** What a new hotel is when its fields do not say: a draft, out of the demo and off the website. */
export const NEW_HOTEL_DEFAULTS = {
  status: "draft",
  demoVisible: false,
  publicShowcase: false,
} as const satisfies Pick<HotelWriteData, "status" | "demoVisible" | "publicShowcase">;

/**
 * A new hotel's row (a staff create or an import's create row): what the fields give, at its resolved
 * destination and slug, a draft hidden from the demo and the showcase unless the fields say otherwise.
 *
 * @example
 * repo.createHotel(toHotelWriteData(request, request.destinationId, slug), actorId);
 */
export function toHotelWriteData(
  fields: HotelProfileFields & { readonly name: string },
  destinationId: string,
  slug: string,
): HotelWriteData {
  return {
    ...profileValues(fields),
    destinationId,
    slug,
    name: fields.name,
    status: fields.status ?? NEW_HOTEL_DEFAULTS.status,
    demoVisible: fields.demoVisible ?? NEW_HOTEL_DEFAULTS.demoVisible,
    publicShowcase: fields.publicShowcase ?? NEW_HOTEL_DEFAULTS.publicShowcase,
  };
}

/**
 * A staff update: exactly the fields the request named (absent leaves a column, null clears it), so an
 * update never overwrites a column it did not mention.
 *
 * @example
 * toHotelUpdatePatch({ minNights: 2, bookingNotes: null }); // writes min_nights, clears booking_notes
 */
export function toHotelUpdatePatch(request: HotelUpdateRequest): HotelUpdatePatch {
  return { ...profileValues(request), destinationId: request.destinationId };
}

/**
 * An import row's update: only the columns its plan found changed. A blank cell never reaches a row, so
 * a blank never clears anything (D-181).
 *
 * @example
 * toImportPatch(row, new Set(["city", "minNights"])); // { city, minNights }
 */
export function toImportPatch(
  row: HotelProfileFields,
  changed: ReadonlySet<HotelProfileKey>,
): HotelUpdatePatch {
  const patch = profileValues(row);
  for (const key of HOTEL_PROFILE_KEYS) {
    if (!changed.has(key)) delete patch[key];
  }
  return patch;
}
