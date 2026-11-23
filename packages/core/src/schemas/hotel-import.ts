import { z } from "zod";

import { uuid } from "./common.js";
import { hotelCatalogueRequestFields } from "./hotel-catalogue.js";
import { catalogueSlug, facilityLabels, hotelStatus } from "./hotels-admin.js";

/*
 * The staff spreadsheet import (TW-25; AC-35.1; D-181): one CSV template per kind, keyed by web address,
 * with fixed headers. The file goes up as raw bytes (`POST /hotels-admin/imports/:kind?dryRun=…`), read
 * only after the guards. A dry run reports what each row would do and writes nothing. On an update a
 * blank cell leaves the value unchanged; status and the flags change only when their cell is filled, or
 * on create. Slices 3 and 4 add the rooms, venues and rates kinds.
 */

/** The kinds of import (Slice 2: hotels; rooms, venues and rates follow). */
export const hotelImportKind = z.enum(["hotels"]);
export type HotelImportKind = z.infer<typeof hotelImportKind>;

/** The largest import file, 5 MiB. */
export const HOTEL_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** The most data rows one file may carry, so one apply stays one bounded transaction. */
export const HOTEL_IMPORT_MAX_ROWS = 2_000;

/** What separates the entries of a list cell (name variants, facilities, cuisines). */
export const HOTEL_IMPORT_LIST_SEPARATOR = "|";

/**
 * The entries of a list written as text: split at each {@link HOTEL_IMPORT_LIST_SEPARATOR} and each line
 * break, trimmed, blank ones dropped. One rule for an import's list cell and the staff editor's
 * one-per-line lists, so a list either of them saves reads back the same through the other (an entry
 * never holds a "|" or a line break).
 *
 * @example
 * hotelListEntries("Pool | Spa, salon and gym\nValet parking"); // ["Pool", "Spa, salon and gym", "Valet parking"]
 */
export function hotelListEntries(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .flatMap((line) => line.split(HOTEL_IMPORT_LIST_SEPARATOR))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

/**
 * The hotels template's columns, in template order. A file may carry any of them; an unknown header is
 * refused.
 */
export const HOTEL_IMPORT_COLUMNS = [
  "destinationSlug",
  "destinationName",
  "slug",
  "name",
  "brand",
  "parentGroup",
  "nameAliases",
  "starCategory",
  "status",
  "demoVisible",
  "publicShowcase",
  "address",
  "locality",
  "city",
  "state",
  "postalCode",
  "latitude",
  "longitude",
  "mapsUrl",
  "streetViewRef",
  "website",
  "descriptionClient",
  "totalRooms",
  "facilities",
  "airportName",
  "airportDistanceKm",
  "airportDriveMinutes",
  "railwayStationName",
  "railwayDistanceKm",
  "railwayDriveMinutes",
  "cityCentreDistanceKm",
  "cityCentreDriveMinutes",
  "accessNotes",
  "totalEventSpaceSqm",
  "totalEventSpaceSqft",
  "weddingBuyoutPolicy",
  "minRoomsWithoutBuyout",
  "minNights",
  "parallelFunctions",
  "bookingNotes",
  "cuisines",
  "isPureVegetarian",
  "hasSeparateVegKitchen",
  "servesAlcohol",
  "internalRating",
  "internalNotes",
  "imageRef",
] as const;
export const hotelImportColumn = z.enum(HOTEL_IMPORT_COLUMNS);
export type HotelImportColumn = z.infer<typeof hotelImportColumn>;

/** The columns every file must carry. */
export const HOTEL_IMPORT_REQUIRED_COLUMNS = [
  "destinationSlug",
  "name",
] as const satisfies readonly HotelImportColumn[];

/** Columns whose cells are numbers. */
export const HOTEL_IMPORT_NUMBER_COLUMNS = [
  "latitude",
  "longitude",
  "totalRooms",
  "airportDistanceKm",
  "airportDriveMinutes",
  "railwayDistanceKm",
  "railwayDriveMinutes",
  "cityCentreDistanceKm",
  "cityCentreDriveMinutes",
  "totalEventSpaceSqm",
  "totalEventSpaceSqft",
  "minRoomsWithoutBuyout",
  "minNights",
  "internalRating",
] as const satisfies readonly HotelImportColumn[];

/** Columns whose cells are true or false (also yes/no and 1/0). */
export const HOTEL_IMPORT_BOOLEAN_COLUMNS = [
  "demoVisible",
  "publicShowcase",
  "isPureVegetarian",
  "hasSeparateVegKitchen",
  "servesAlcohol",
] as const satisfies readonly HotelImportColumn[];

/** Columns whose cells are lists, entries separated by {@link HOTEL_IMPORT_LIST_SEPARATOR}. */
export const HOTEL_IMPORT_LIST_COLUMNS = [
  "nameAliases",
  "cuisines",
  "facilities",
] as const satisfies readonly HotelImportColumn[];

/**
 * One parsed row of the hotels template. The API's CSV reader turns each cell into its type first and
 * leaves blank cells out, so a missing key means "leave unchanged" on an update.
 *
 * @example
 * hotelImportRow.parse({ destinationSlug: "udaipur", name: "Synthetic Lake Hotel", city: "Udaipur" });
 */
export const hotelImportRow = z
  .object({
    destinationSlug: catalogueSlug,
    destinationName: z.string().trim().max(255).optional(),
    slug: catalogueSlug.optional(),
    name: z.string().trim().min(1).max(255),
    brand: z.string().trim().max(255).optional(),
    starCategory: z.string().trim().max(255).optional(),
    status: hotelStatus.optional(),
    demoVisible: z.boolean().optional(),
    publicShowcase: z.boolean().optional(),
    address: z.string().trim().max(10_000).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    streetViewRef: z.string().trim().max(255).optional(),
    website: z.string().trim().url().max(255).optional(),
    descriptionClient: z.string().trim().max(10_000).optional(),
    totalRooms: z.number().int().min(0).max(100_000).optional(),
    facilities: facilityLabels.optional(),
    internalRating: z.number().int().min(1).max(5).optional(),
    internalNotes: z.string().trim().max(10_000).optional(),
    // An optional reference (URL or file name) to the hotel's lead image: the import registers a pending,
    // internal gallery media asset by reference, the reference kept in its audit event (never a caption).
    imageRef: z.string().trim().max(255).optional(),
    ...hotelCatalogueRequestFields,
  })
  .strict();
export type HotelImportRow = z.infer<typeof hotelImportRow>;

/** The import's query: `dryRun=true` reports what each row would do and writes nothing. */
export const hotelImportQuery = z
  .object({
    dryRun: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .strict();
export type HotelImportQuery = z.infer<typeof hotelImportQuery>;

/** One rejected row of an import: its 1-based line and the field errors found on it. */
export const hotelImportRowError = z
  .object({
    line: z.number().int().min(1),
    errors: z.array(z.object({ field: z.string(), message: z.string() }).strict()),
  })
  .strict();
export type HotelImportRowError = z.infer<typeof hotelImportRowError>;

/** What an import does, or would do on a dry run, to one row. */
export const hotelImportRowOutcome = z.enum(["create", "update", "unchanged", "error"]);
export type HotelImportRowOutcome = z.infer<typeof hotelImportRowOutcome>;

/**
 * One row of the import report: its line, its hotel's web address, its outcome and the names of the
 * fields it changes (never their values). An "error" row's messages are in `rejected`.
 */
export const hotelImportRowReport = z
  .object({
    line: z.number().int().min(1),
    slug: z.string().nullable(),
    outcome: hotelImportRowOutcome,
    changedFields: z.array(hotelImportColumn),
  })
  .strict();
export type HotelImportRowReport = z.infer<typeof hotelImportRowReport>;

/**
 * The outcome of an import. On a dry run `applied` is false, nothing was written, and the counts say what
 * applying would do. On a real run `applied` is true when the run wrote anything (a hotel created or
 * updated, or an image registered) and false when it wrote nothing, every row unchanged or rejected; the
 * job is still recorded `applied` when any row was valid, `failed` when none was. `created`, `updated`
 * and `unchanged` count the hotels; `destinationsCreated` the destinations made on the way;
 * `mediaRegistered` the pending gallery images registered by reference; `rejected` the rows that failed,
 * by line and field; `rows` every row's outcome. `importJobId` is the `import_jobs` record.
 */
export const hotelImportResult = z
  .object({
    importJobId: uuid,
    dryRun: z.boolean(),
    applied: z.boolean(),
    totalRows: z.number().int().min(0),
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    unchanged: z.number().int().min(0),
    destinationsCreated: z.number().int().min(0),
    mediaRegistered: z.number().int().min(0),
    rejected: z.array(hotelImportRowError),
    rows: z.array(hotelImportRowReport),
  })
  .strict();
export type HotelImportResult = z.infer<typeof hotelImportResult>;
