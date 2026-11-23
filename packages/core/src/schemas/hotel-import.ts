import { z } from "zod";

import { uuid } from "./common.js";
import { hotelCatalogueRequestFields } from "./hotel-catalogue.js";
import {
  ROOM_IMPORT_BOOLEAN_COLUMNS,
  ROOM_IMPORT_COLUMNS,
  ROOM_IMPORT_ENUM_COLUMNS,
  ROOM_IMPORT_LIST_COLUMNS,
  ROOM_IMPORT_NUMBER_COLUMNS,
  ROOM_IMPORT_REQUIRED_COLUMNS,
  roomImportColumn,
  VENUE_IMPORT_BOOLEAN_COLUMNS,
  VENUE_IMPORT_CAPACITY_COLUMNS,
  VENUE_IMPORT_COLUMNS,
  VENUE_IMPORT_ENUM_COLUMNS,
  VENUE_IMPORT_LAYOUT_COLUMNS,
  VENUE_IMPORT_LIST_COLUMNS,
  VENUE_IMPORT_NUMBER_COLUMNS,
  VENUE_IMPORT_REQUIRED_COLUMNS,
  venueImportColumn,
} from "./hotel-import-rooms-venues.js";
import { catalogueSlug, facilityLabels, hotelStatus } from "./hotels-admin.js";

/*
 * The staff spreadsheet import (TW-25; AC-35.1; D-181): one CSV template per kind (hotels here, rooms and
 * venues in hotel-import-rooms-venues.ts), keyed by web address, with fixed headers; the cell rules are in
 * hotel-import-cells.ts. Every upload is a preview (`POST /hotels-admin/imports/<kind>`, raw bytes read
 * only after the guards): it writes nothing but its `import_jobs` record, which keeps the value-free
 * report and the planned rows. Import applies that preview by its job id
 * (`POST /hotels-admin/imports/<kind>/:jobId/apply`) within {@link HOTEL_IMPORT_PREVIEW_TTL_HOURS} hours,
 * refusing a row whose target changed since. On an update a blank cell leaves the value unchanged; status
 * and the flags change only when their cell is filled, or on create. Slice 4 adds the rates kind.
 */

/** The kinds of import (rates follow in Slice 4). Each maps to its `import_jobs.import_type`. */
export const hotelImportKind = z.enum(["hotels", "rooms", "venues"]);
export type HotelImportKind = z.infer<typeof hotelImportKind>;

/** The largest import file, 5 MiB. */
export const HOTEL_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** The most data rows one file may carry, so one apply stays one bounded transaction. */
export const HOTEL_IMPORT_MAX_ROWS = 2_000;

/** How long a preview can be imported, in hours: after that it is validated again (TW-25 says so). */
export const HOTEL_IMPORT_PREVIEW_TTL_HOURS = 24;

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

/** Columns whose cells are lists, entries separated by "|" (`hotelListEntries`). */
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

/**
 * The cell rules of one import kind, for the API's reader and the staff app's template and help: its
 * columns in template order, the ones a file must carry, and how each typed column's cells read (numbers,
 * booleans, lists by `hotelListEntries`, enum values by `hotelImportEnumValue`, other layouts by
 * `parseVenueLayoutsCell`). `capacityColumns` are number columns that take one number: a range there is
 * refused with `VENUE_CAPACITY_RANGE_MESSAGE` (`isNumberRangeCell`). The hotels template reads its enum
 * cells as exact values, as in Slice 2.
 */
export interface HotelImportTemplate {
  readonly columns: readonly string[];
  readonly requiredColumns: readonly string[];
  readonly numberColumns: readonly string[];
  readonly booleanColumns: readonly string[];
  readonly listColumns: readonly string[];
  readonly enumColumns: readonly string[];
  readonly layoutColumns: readonly string[];
  readonly capacityColumns: readonly string[];
}

/**
 * Each import kind's template.
 *
 * @example
 * HOTEL_IMPORT_TEMPLATES.rooms.requiredColumns; // ["hotelSlug", "name"]
 */
export const HOTEL_IMPORT_TEMPLATES: Readonly<Record<HotelImportKind, HotelImportTemplate>> = {
  hotels: {
    columns: HOTEL_IMPORT_COLUMNS,
    requiredColumns: HOTEL_IMPORT_REQUIRED_COLUMNS,
    numberColumns: HOTEL_IMPORT_NUMBER_COLUMNS,
    booleanColumns: HOTEL_IMPORT_BOOLEAN_COLUMNS,
    listColumns: HOTEL_IMPORT_LIST_COLUMNS,
    enumColumns: [],
    layoutColumns: [],
    capacityColumns: [],
  },
  rooms: {
    columns: ROOM_IMPORT_COLUMNS,
    requiredColumns: ROOM_IMPORT_REQUIRED_COLUMNS,
    numberColumns: ROOM_IMPORT_NUMBER_COLUMNS,
    booleanColumns: ROOM_IMPORT_BOOLEAN_COLUMNS,
    listColumns: ROOM_IMPORT_LIST_COLUMNS,
    enumColumns: ROOM_IMPORT_ENUM_COLUMNS,
    layoutColumns: [],
    capacityColumns: [],
  },
  venues: {
    columns: VENUE_IMPORT_COLUMNS,
    requiredColumns: VENUE_IMPORT_REQUIRED_COLUMNS,
    numberColumns: VENUE_IMPORT_NUMBER_COLUMNS,
    booleanColumns: VENUE_IMPORT_BOOLEAN_COLUMNS,
    listColumns: VENUE_IMPORT_LIST_COLUMNS,
    enumColumns: VENUE_IMPORT_ENUM_COLUMNS,
    layoutColumns: VENUE_IMPORT_LAYOUT_COLUMNS,
    capacityColumns: VENUE_IMPORT_CAPACITY_COLUMNS,
  },
};

/**
 * The preview's query. Every upload is a preview, so nothing needs saying; `dryRun=true` is still taken
 * for one release because the previous staff bundle's Validate sends it (Slice 4 removes it), while
 * `dryRun=false`, the previous bundle's import, is refused: an import now applies a preview by its job id.
 */
export const hotelImportQuery = z
  .object({
    dryRun: z
      .literal("true", "An upload is always a preview: validate the file, then import that preview")
      .optional(),
  })
  .strict();
export type HotelImportQuery = z.infer<typeof hotelImportQuery>;

/** The apply route's params: the preview's `import_jobs` id. */
export const hotelImportApplyParams = z.object({ jobId: uuid }).strict();
export type HotelImportApplyParams = z.infer<typeof hotelImportApplyParams>;

/**
 * The apply route's body: nothing, or an empty JSON object. The plan comes from the stored preview, never
 * from the request.
 */
export const hotelImportApplyBody = z.object({}).strict().optional();
export type HotelImportApplyBody = z.infer<typeof hotelImportApplyBody>;

/** One rejected row of an import: its 1-based line and the field errors found on it. */
export const hotelImportRowError = z
  .object({
    line: z.number().int().min(1),
    errors: z.array(z.object({ field: z.string(), message: z.string() }).strict()),
  })
  .strict();
export type HotelImportRowError = z.infer<typeof hotelImportRowError>;

/** What an import does, or would do on a preview, to one row. */
export const hotelImportRowOutcome = z.enum(["create", "update", "unchanged", "error"]);
export type HotelImportRowOutcome = z.infer<typeof hotelImportRowOutcome>;

/** A column a report row names as changed: one of its kind's template columns (the API checks which). */
export const hotelImportChangedField = z.union([
  hotelImportColumn,
  roomImportColumn,
  venueImportColumn,
]);
export type HotelImportChangedField = z.infer<typeof hotelImportChangedField>;

/**
 * One row of the import report: its line, its hotel's web address, the name of the hotel, room or venue
 * it reads (null when the row has none to show), its outcome and the names of the fields it changes
 * (never their values). An "error" row's messages are in `rejected`.
 */
export const hotelImportRowReport = z
  .object({
    line: z.number().int().min(1),
    slug: z.string().nullable(),
    name: z.string().nullable(),
    outcome: hotelImportRowOutcome,
    changedFields: z.array(hotelImportChangedField),
  })
  .strict();
export type HotelImportRowReport = z.infer<typeof hotelImportRowReport>;

/**
 * The outcome of a preview or of its import, for one `kind`. A preview (`dryRun` true) wrote nothing but
 * its job, so `applied` is false and the counts say what importing would do. An import (`dryRun` false)
 * answers with the preview's own `importJobId`: `applied` is true when it wrote anything (a row created or
 * updated, or an image registered) and false when it wrote nothing, every row unchanged or refused, a row
 * changed since the preview among them. `created`, `updated` and `unchanged` count the kind's rows
 * (hotels, rooms or venues); `destinationsCreated` the destinations a hotels import made on the way and
 * `mediaRegistered` the pending gallery images it registered by reference (both 0 for rooms and venues);
 * `rejected` the rows refused, by line and field; `rows` every row's outcome.
 */
export const hotelImportResult = z
  .object({
    importJobId: uuid,
    kind: hotelImportKind,
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
