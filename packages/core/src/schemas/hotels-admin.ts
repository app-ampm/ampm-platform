import { z } from "zod";

import { cursorQuery, storableText, uuid } from "./common.js";
import { hotelCatalogueRequestFields } from "./hotel-catalogue.js";
import {
  hotelVenueSetting,
  roomCatalogueRequestFields,
  roomCatalogueViewFields,
  VENUE_CAPACITY_MAX,
  venueCatalogueRequestFields,
  venueCatalogueViewFields,
} from "./hotel-rooms-venues.js";
import { hotelVenueType } from "./hotels.js";

/*
 * Contracts for the STAFF hotel workspace (Module C "Hotel intelligence"; docs/data-model.md §5,
 * permission-matrix §5.3). Feature 9.1: destinations, room categories, venues and contacts, the hotel
 * writes and the spreadsheet import. The staff hotel itself is one model per audience, in
 * `hotel-staff-views.ts` (D-171): its RESTRICTED-NOTES (internal rating/notes) and RESTRICTED-CONTACT
 * (contacts) parts reach only the principals whose grants read them; the client discovery views in
 * `hotels.ts` are a separate, PUBLIC+CLIENT-only model (security.md: one response model per audience).
 * Rate cards, verifications, media and references are features 9.2/9.3 and are not modelled here.
 */

/** Hotel and destination lifecycle (HotelStatus / DestinationStatus in the Prisma schema). */
export const hotelStatus = z.enum(["draft", "active", "inactive"]);
export type HotelStatus = z.infer<typeof hotelStatus>;

/** The most facilities a hotel, a room category or a venue lists, and the longest one. */
export const FACILITY_LABELS_MAX = 100;
export const FACILITY_LABEL_MAX_LENGTH = 120;

/**
 * A list of free-text facility labels (facilities_json): a hotel's, a room category's or a venue's, at
 * most {@link FACILITY_LABELS_MAX} of at most {@link FACILITY_LABEL_MAX_LENGTH} characters each. An entry
 * holding the null character is refused on its own index (`storableText`).
 *
 * @example
 * facilityLabels.parse(["wifi", "pool", "spa"]);
 */
export const facilityLabels = z
  .array(storableText().min(1).max(FACILITY_LABEL_MAX_LENGTH))
  .max(FACILITY_LABELS_MAX);

const slug = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase words joined by single hyphens");

/** A web address (slug): lowercase words joined by single hyphens. Shared with the import (hotel-import.ts). */
export const catalogueSlug = slug;

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

/**
 * A destination as the staff Destinations screen lists it (TW-20): its fields plus how many hotels are
 * filed under it (any status, deleted hotels left out). Only `GET /hotels-admin/destinations` returns it;
 * a hotel's own `destination` stays the plain {@link destinationView}.
 *
 * @example
 * destinationListItemView.parse({ ...udaipur, hotelCount: 12 });
 */
export const destinationListItemView = destinationView
  .extend({ hotelCount: z.number().int().min(0) })
  .strict();
export type DestinationListItemView = z.infer<typeof destinationListItemView>;

/** The staff destination list (`{ items }`, name-ordered; the whole reference set, not paginated). */
export const destinationList = z.object({ items: z.array(destinationListItemView) }).strict();
export type DestinationList = z.infer<typeof destinationList>;

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
    facilities: facilityLabels.nullable(),
    description: z.string().nullable(),
    ...roomCatalogueViewFields, // unit type, view, bed configuration, size in sq ft (D-178)
  })
  .strict();
export type RoomCategoryView = z.infer<typeof roomCategoryView>;

/**
 * A room category's fields as a request writes them, with no create-time default, so the update (a
 * `.partial()` of them) never leaks one: absent leaves a value, null clears it. The staff requests and
 * the rooms import row spread them, so their bounds are one. A filled `sizeSqft` gives the `sizeSqm` at
 * write (core `areaWrite`); `maxOccupancy` is at least 1 when stated, which a database CHECK backs. The
 * room count stops where a hotel's total rooms does, so no row reaches the integer column out of range.
 *
 * @example
 * z.object(roomCategoryRequestFields).parse({ name: "Lake View Suite", unitType: "suite", sizeSqft: 650 });
 */
export const roomCategoryRequestFields = {
  name: storableText().min(1).max(255),
  roomCount: z.number().int().min(0).max(100_000).nullish(),
  maxOccupancy: z.number().int().min(1).max(100).nullish(),
  sizeSqm: z.number().int().min(0).max(100_000).nullish(),
  facilities: facilityLabels.nullish(),
  description: storableText().max(10_000).nullish(),
  ...roomCatalogueRequestFields,
};

export const roomCategoryCreateRequest = z.object(roomCategoryRequestFields).strict();
export type RoomCategoryCreateRequest = z.infer<typeof roomCategoryCreateRequest>;

export const roomCategoryUpdateRequest = z
  .object(roomCategoryRequestFields)
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
    isIndoor: z.boolean(), // true only for indoor: the API keeps it in step (`isIndoorSetting`)
    areaSqm: z.number().int().nullable(),
    capacityBanquet: z.number().int().nullable(),
    capacityTheatre: z.number().int().nullable(),
    capacityReception: z.number().int().nullable(),
    facilities: facilityLabels.nullable(),
    description: z.string().nullable(),
    ...venueCatalogueViewFields, // setting, area in sq ft, dimensions, layouts, notes (D-178)
  })
  .strict();
export type VenueView = z.infer<typeof venueView>;

const venueCapacity = z.number().int().min(0).max(VENUE_CAPACITY_MAX).nullish();

/**
 * A venue's fields as a request writes them, with no create-time default (see
 * {@link roomCategoryRequestFields}). `setting` is required on create and decides `is_indoor`, which no
 * request carries: the API writes it, true only for indoor. The capacities mean (decision 11): banquet
 * seated, dinner at round tables; reception floating, a standing reception or cocktails; theatre rows of
 * chairs. A range keeps its maximum in the capacity and the range in `capacityNotes`. A filled
 * `areaSqft` or `prefunctionAreaSqft` gives its m² at write (core `areaWrite`).
 *
 * @example
 * z.object(venueRequestFields).parse({ name: "Synthetic Terrace", venueType: "terrace", setting: "semi_open" });
 */
export const venueRequestFields = {
  name: storableText().min(1).max(255),
  venueType: hotelVenueType,
  setting: hotelVenueSetting,
  areaSqm: z.number().int().min(0).max(1_000_000).nullish(),
  capacityBanquet: venueCapacity,
  capacityTheatre: venueCapacity,
  capacityReception: venueCapacity,
  facilities: facilityLabels.nullish(),
  description: storableText().max(10_000).nullish(),
  ...venueCatalogueRequestFields,
};

export const venueCreateRequest = z.object(venueRequestFields).strict();
export type VenueCreateRequest = z.infer<typeof venueCreateRequest>;

export const venueUpdateRequest = z
  .object(venueRequestFields)
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

// The phone stays free text on the wire: the API stores it in E.164 (core `normaliseHotelPhone`, refused
// with `HOTEL_PHONE_REFUSAL`) yet accepts a phone equal to the stored one unchanged, so a legacy free-text
// phone never blocks an unrelated edit. `isPrimary: true` makes the contact the hotel's one live primary:
// the API demotes the current one in the same transaction (a partial unique index backs it). Text holding
// the null character is refused on its field (`storableText`).
const hotelContactFields = {
  name: storableText().min(1).max(255),
  roleTitle: storableText().max(255).nullish(),
  phone: storableText().max(255).nullish(),
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

// --- Hotel writes and the staff list query (the staff hotel views are in hotel-staff-views.ts) ---

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
  totalRooms: z.number().int().min(0).max(100_000).nullish(),
  streetViewRef: z.string().trim().max(255).nullish(),
  facilities: facilityLabels.nullish(),
  ...hotelCatalogueRequestFields, // location, access, event space, booking terms, food (D-178)
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

// The spreadsheet import (TW-25; D-181) is in hotel-import.ts.
