import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";
import { hotelVenueType } from "./hotels.js";

/*
 * Contracts for the STAFF hotel workspace (Module C "Hotel intelligence"; docs/data-model.md §5,
 * permission-matrix §5.3). Feature 9.1: hotel profiles with their internal fields, room categories,
 * venues and contacts, plus the spreadsheet import. These are the Hotel-team (HT) and Super-Admin (SA)
 * views — RESTRICTED-NOTES (internal rating/notes) and RESTRICTED-CONTACT (contacts) fields ARE present
 * here because the audience is staff with the `hotels.*` keys; the client discovery views in `hotels.ts`
 * are a separate, PUBLIC+CLIENT-only model (security.md: one response model per audience). Rate cards,
 * verifications, media and references are features 9.2/9.3 and are not modelled here yet.
 */

/** Hotel and destination lifecycle (HotelStatus / DestinationStatus in the Prisma schema). */
export const hotelStatus = z.enum(["draft", "active", "inactive"]);
export type HotelStatus = z.infer<typeof hotelStatus>;

/** A list of free-text facility labels (facilities_json; e.g. ["wifi", "pool", "spa"]). */
const facilities = z.array(z.string().trim().min(1).max(120)).max(100);

const slug = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase words joined by single hyphens");

// --- Destinations (data-model.md §5; permission-matrix hotels.destinations) ---

export const destinationView = z
  .object({
    id: uuid,
    name: z.string(),
    slug: z.string(),
    region: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string(),
    description: z.string().nullable(),
    status: hotelStatus,
    publicVisible: z.boolean(),
  })
  .strict();
export type DestinationView = z.infer<typeof destinationView>;

// Fields with NO create-time defaults, so the update (a `.partial()` of these) never leaks a default:
// an absent field means "leave it unchanged", and an empty patch is genuinely empty.
const destinationFields = {
  name: z.string().trim().min(1).max(255),
  slug: slug.optional(), // derived from the name when omitted
  region: z.string().trim().max(255).nullish(),
  state: z.string().trim().max(255).nullish(),
  country: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10_000).nullish(),
  status: hotelStatus,
  publicVisible: z.boolean(),
};

export const destinationCreateRequest = z
  .object({
    ...destinationFields,
    country: z.string().trim().min(1).max(255).default("India"),
    status: hotelStatus.default("draft"),
    publicVisible: z.boolean().default(false),
  })
  .strict();
export type DestinationCreateRequest = z.infer<typeof destinationCreateRequest>;

export const destinationUpdateRequest = z
  .object(destinationFields)
  .omit({ slug: true }) // the slug is immutable once set — recreate the destination to change it
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type DestinationUpdateRequest = z.infer<typeof destinationUpdateRequest>;

// --- Room categories (data-model.md §5; permission-matrix hotels.room_categories_venues) ---

export const roomCategoryView = z
  .object({
    id: uuid,
    hotelId: uuid,
    name: z.string(),
    roomCount: z.number().int().nullable(),
    maxOccupancy: z.number().int().nullable(),
    sizeSqm: z.number().int().nullable(),
    facilities: facilities.nullable(),
    description: z.string().nullable(),
  })
  .strict();
export type RoomCategoryView = z.infer<typeof roomCategoryView>;

export const roomCategoryCreateRequest = z
  .object({
    name: z.string().trim().min(1).max(255),
    roomCount: z.number().int().min(0).nullish(),
    maxOccupancy: z.number().int().min(0).nullish(),
    sizeSqm: z.number().int().min(0).nullish(),
    facilities: facilities.nullish(),
    description: z.string().trim().max(10_000).nullish(),
  })
  .strict();
export type RoomCategoryCreateRequest = z.infer<typeof roomCategoryCreateRequest>;

export const roomCategoryUpdateRequest = roomCategoryCreateRequest
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type RoomCategoryUpdateRequest = z.infer<typeof roomCategoryUpdateRequest>;

// --- Venues (data-model.md §5; permission-matrix hotels.room_categories_venues) ---

export const venueView = z
  .object({
    id: uuid,
    hotelId: uuid,
    name: z.string(),
    venueType: hotelVenueType,
    isIndoor: z.boolean(),
    areaSqm: z.number().int().nullable(),
    capacityBanquet: z.number().int().nullable(),
    capacityTheatre: z.number().int().nullable(),
    capacityReception: z.number().int().nullable(),
    facilities: facilities.nullable(),
    description: z.string().nullable(),
  })
  .strict();
export type VenueView = z.infer<typeof venueView>;

export const venueCreateRequest = z
  .object({
    name: z.string().trim().min(1).max(255),
    venueType: hotelVenueType,
    isIndoor: z.boolean(),
    areaSqm: z.number().int().min(0).nullish(),
    capacityBanquet: z.number().int().min(0).nullish(),
    capacityTheatre: z.number().int().min(0).nullish(),
    capacityReception: z.number().int().min(0).nullish(),
    facilities: facilities.nullish(),
    description: z.string().trim().max(10_000).nullish(),
  })
  .strict();
export type VenueCreateRequest = z.infer<typeof venueCreateRequest>;

export const venueUpdateRequest = venueCreateRequest
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type VenueUpdateRequest = z.infer<typeof venueUpdateRequest>;

// --- Hotel contacts (RESTRICTED-CONTACT; permission-matrix hotels.hotel_contacts) ---

export const hotelContactView = z
  .object({
    id: uuid,
    hotelId: uuid,
    name: z.string(),
    roleTitle: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    isPrimary: z.boolean(),
  })
  .strict();
export type HotelContactView = z.infer<typeof hotelContactView>;

const hotelContactFields = {
  name: z.string().trim().min(1).max(255),
  roleTitle: z.string().trim().max(255).nullish(),
  phone: z.string().trim().max(255).nullish(),
  email: z.string().trim().toLowerCase().email().max(255).nullish(),
  isPrimary: z.boolean(),
};

export const hotelContactCreateRequest = z
  .object({ ...hotelContactFields, isPrimary: z.boolean().default(false) })
  .strict();
export type HotelContactCreateRequest = z.infer<typeof hotelContactCreateRequest>;

export const hotelContactUpdateRequest = z
  .object(hotelContactFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type HotelContactUpdateRequest = z.infer<typeof hotelContactUpdateRequest>;

// --- Hotel (staff view with internal fields + nested rooms/venues/contacts on detail) ---

const hotelStaffBase = z.object({
  id: uuid,
  destinationId: uuid,
  name: z.string(),
  slug: z.string(),
  brand: z.string().nullable(),
  starCategory: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  descriptionClient: z.string().nullable(),
  website: z.string().nullable(),
  status: hotelStatus,
  demoVisible: z.boolean(),
  publicShowcase: z.boolean(),
  internalRating: z.number().int().nullable(), // RESTRICTED-NOTES
  internalNotes: z.string().nullable(), // RESTRICTED-NOTES
  totalRooms: z.number().int().nullable(),
  streetViewRef: z.string().nullable(),
  lastVerifiedAt: isoDateTime.nullable(),
});

/** A hotel in the staff list (HT/SA): the full profile, no nested collections. */
export const hotelStaffView = hotelStaffBase.strict();
export type HotelStaffView = z.infer<typeof hotelStaffView>;

/** A hotel on the staff detail page: the profile plus its rooms, venues and contacts. */
export const hotelStaffDetailView = hotelStaffBase
  .extend({
    destination: destinationView,
    rooms: z.array(roomCategoryView),
    venues: z.array(venueView),
    contacts: z.array(hotelContactView),
  })
  .strict();
export type HotelStaffDetailView = z.infer<typeof hotelStaffDetailView>;

const hotelProfileFields = {
  name: z.string().trim().min(1).max(255),
  brand: z.string().trim().max(255).nullish(),
  starCategory: z.string().trim().max(255).nullish(),
  address: z.string().trim().max(10_000).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  descriptionClient: z.string().trim().max(10_000).nullish(),
  website: z.string().trim().url().max(255).nullish(),
  status: hotelStatus,
  demoVisible: z.boolean(),
  publicShowcase: z.boolean(),
  internalRating: z.number().int().min(1).max(5).nullish(),
  internalNotes: z.string().trim().max(10_000).nullish(),
  totalRooms: z.number().int().min(0).nullish(),
  streetViewRef: z.string().trim().max(255).nullish(),
};

export const hotelCreateRequest = z
  .object({
    destinationId: uuid,
    slug: slug.optional(),
    ...hotelProfileFields,
    status: hotelStatus.default("draft"),
    demoVisible: z.boolean().default(false),
    publicShowcase: z.boolean().default(false),
  })
  .strict();
export type HotelCreateRequest = z.infer<typeof hotelCreateRequest>;

export const hotelUpdateRequest = z
  .object({ destinationId: uuid.optional(), ...hotelProfileFields })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type HotelUpdateRequest = z.infer<typeof hotelUpdateRequest>;

export const hotelStaffListQuery = cursorQuery.extend({
  cursor: uuid.optional(),
  destinationId: uuid.optional(),
  status: hotelStatus.optional(),
  q: z.string().trim().max(255).optional(),
});
export type HotelStaffListQuery = z.infer<typeof hotelStaffListQuery>;

export const hotelStaffPage = page(hotelStaffView);
export type HotelStaffPage = z.infer<typeof hotelStaffPage>;

// --- Spreadsheet import (TW-25; AC-35.1). One CSV row per hotel; a destination is resolved or created
// by slug; a hotel is upserted by slug (idempotent). Rooms, venues and rate cards extend this in 9.2. ---

/**
 * One parsed row of the hotel import template. Every cell arrives as a string (CSV), so numeric and
 * boolean columns coerce. `destinationSlug` must resolve to, or create, a destination; `slug` is derived
 * from `name` when the column is blank.
 */
export const hotelImportRow = z
  .object({
    destinationSlug: slug,
    destinationName: z.string().trim().max(255).optional(),
    slug: slug.optional(),
    name: z.string().trim().min(1).max(255),
    brand: z.string().trim().max(255).optional(),
    starCategory: z.string().trim().max(255).optional(),
    address: z.string().trim().max(10_000).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    descriptionClient: z.string().trim().max(10_000).optional(),
    website: z.string().trim().url().max(255).optional(),
    totalRooms: z.number().int().min(0).optional(),
    demoVisible: z.boolean().optional(),
    status: hotelStatus.optional(),
    internalRating: z.number().int().min(1).max(5).optional(),
    internalNotes: z.string().trim().max(10_000).optional(),
    streetViewRef: z.string().trim().max(255).optional(),
    // slice 5b: an optional reference (URL/filename) to the hotel's lead image. The importer registers a
    // PENDING gallery media_asset by reference (bytes uploaded later); the reference is kept as the caption.
    imageRef: z.string().trim().max(255).optional(),
  })
  .strict(); // the API's CSV parser coerces string cells to these types (and blanks to undefined) first
export type HotelImportRow = z.infer<typeof hotelImportRow>;

export const hotelImportRequest = z
  .object({
    content: z.string().min(1).max(5_000_000), // the CSV text of the filled template
    dryRun: z.boolean().default(false), // validate and report only; make no changes
  })
  .strict();
export type HotelImportRequest = z.infer<typeof hotelImportRequest>;

/** One rejected row of an import: its 1-based line and the field errors found on it. */
export const hotelImportRowError = z
  .object({
    line: z.number().int().min(1),
    errors: z.array(z.object({ field: z.string(), message: z.string() }).strict()),
  })
  .strict();
export type HotelImportRowError = z.infer<typeof hotelImportRowError>;

/**
 * The outcome of an import. On a dry run `applied` is false and nothing was written. `created`/`updated`
 * count the hotels upserted; `destinationsCreated` the destinations made on the way; `mediaRegistered` the
 * pending gallery images registered by reference (slice 5b, idempotent — a re-run registers none again);
 * `rejected` are the rows that failed validation (named by line and field). `importJobId` is the
 * `import_jobs` record.
 */
export const hotelImportResult = z
  .object({
    importJobId: uuid,
    dryRun: z.boolean(),
    applied: z.boolean(),
    totalRows: z.number().int().min(0),
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    destinationsCreated: z.number().int().min(0),
    mediaRegistered: z.number().int().min(0),
    rejected: z.array(hotelImportRowError),
  })
  .strict();
export type HotelImportResult = z.infer<typeof hotelImportResult>;
