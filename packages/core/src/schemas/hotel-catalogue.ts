import { z } from "zod";

import { isGoogleMapsUrl, MAPS_URL_MAX_LENGTH } from "../hotel-location.js";
import { hasAtMostDecimals } from "../hotel-units.js";

/*
 * The catalogue's homes for every hotel information form answer and recurring fact-sheet fact (D-178;
 * docs/planning/hotel-information-form-plan.md §6.2): location and access, total event space, booking
 * terms, and food and beverage. Every field is nullable and optional. Name variants and the booking terms
 * are INTERNAL (decision 12): every staff profile reader gets them and no client view carries them. The
 * CLIENT ones reach the client views only when those grow (Slice 12).
 */

/** Whether a wedding needs the whole hotel (HotelWeddingBuyoutPolicy in the Prisma schema; keep in step). */
export const hotelWeddingBuyoutPolicy = z.enum(["not_required", "required", "depends"]);
export type HotelWeddingBuyoutPolicy = z.infer<typeof hotelWeddingBuyoutPolicy>;

/** Whether several functions can run at once or on one day (HotelParallelFunctions; keep in step). */
export const hotelParallelFunctions = z.enum(["allowed", "not_allowed", "depends"]);
export type HotelParallelFunctions = z.infer<typeof hotelParallelFunctions>;

/** The most name variants a hotel keeps (name_aliases_json). */
export const HOTEL_NAME_ALIASES_MAX = 20;

/** The most cuisine labels a hotel keeps (cuisines_json). */
export const HOTEL_CUISINES_MAX = 30;

const distinctIgnoringCase = (values: readonly string[]): boolean =>
  new Set(values.map((value) => value.toLowerCase())).size === values.length;

/**
 * A hotel's other names, as fact sheets and staff spell it (INTERNAL; duplicate hints and imports use them).
 *
 * @example
 * hotelNameAliases.parse(["Synthetic Lake Hotel", "The Synthetic Lake"]);
 */
export const hotelNameAliases = z
  .array(z.string().trim().min(1).max(255))
  .max(HOTEL_NAME_ALIASES_MAX)
  .refine(distinctIgnoringCase, "Give each name variant once");

/**
 * A hotel's cuisine labels: options from configuration `hotel.cuisine_options`, or "Other".
 *
 * @example
 * hotelCuisineLabels.parse(["Indian", "Italian"]);
 */
export const hotelCuisineLabels = z
  .array(z.string().trim().min(1).max(60))
  .max(HOTEL_CUISINES_MAX)
  .refine(distinctIgnoringCase, "Give each cuisine once");

/** A Google Maps link: https, a Google Maps host and path, at most 2,048 characters; never fetched. */
export const hotelMapsUrl = z
  .string()
  .trim()
  .max(MAPS_URL_MAX_LENGTH)
  .refine(isGoogleMapsUrl, "Use an https Google Maps link");

const shortText = z.string().trim().max(255);
const longText = z.string().trim().max(10_000);
const distanceKm = z
  .number()
  .min(0)
  .max(999.9)
  .refine((value) => hasAtMostDecimals(value, 1), "At most one decimal place");
const driveMinutes = z.number().int().min(0).max(600);

/**
 * The D-178 fields as a request writes them, each `.nullish()`: absent leaves a value, null clears it. The
 * staff create and update requests and the import row spread them. The postal code's India rule needs the
 * destination's country, so the API checks it (`postalCodeProblem`). A filled `totalEventSpaceSqft` gives
 * the `totalEventSpaceSqm` at write (core `areaWrite`, Slice 3).
 */
export const hotelCatalogueRequestFields = {
  parentGroup: shortText.nullish(),
  nameAliases: hotelNameAliases.nullish(),
  locality: shortText.nullish(),
  city: shortText.nullish(),
  state: shortText.nullish(),
  postalCode: z.string().trim().max(16).nullish(),
  mapsUrl: hotelMapsUrl.nullish(),
  airportName: shortText.nullish(),
  airportDistanceKm: distanceKm.nullish(),
  airportDriveMinutes: driveMinutes.nullish(),
  railwayStationName: shortText.nullish(),
  railwayDistanceKm: distanceKm.nullish(),
  railwayDriveMinutes: driveMinutes.nullish(),
  cityCentreDistanceKm: distanceKm.nullish(),
  cityCentreDriveMinutes: driveMinutes.nullish(),
  accessNotes: longText.nullish(),
  totalEventSpaceSqm: z.number().int().min(0).max(1_000_000).nullish(),
  totalEventSpaceSqft: z.number().int().min(0).max(10_000_000).nullish(),
  weddingBuyoutPolicy: hotelWeddingBuyoutPolicy.nullish(),
  minRoomsWithoutBuyout: z.number().int().min(0).max(10_000).nullish(),
  minNights: z.number().int().min(1).max(60).nullish(),
  parallelFunctions: hotelParallelFunctions.nullish(),
  bookingNotes: longText.nullish(),
  cuisines: hotelCuisineLabels.nullish(),
  isPureVegetarian: z.boolean().nullish(),
  hasSeparateVegKitchen: z.boolean().nullish(),
  servesAlcohol: z.boolean().nullish(),
};

/** The same D-178 fields as the staff hotel views carry them (every staff profile reader, D-171). */
export const hotelCatalogueViewFields = {
  parentGroup: z.string().nullable(),
  nameAliases: z.array(z.string()).nullable(), // INTERNAL
  locality: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  airportName: z.string().nullable(),
  airportDistanceKm: z.number().nullable(),
  airportDriveMinutes: z.number().int().nullable(),
  railwayStationName: z.string().nullable(),
  railwayDistanceKm: z.number().nullable(),
  railwayDriveMinutes: z.number().int().nullable(),
  cityCentreDistanceKm: z.number().nullable(),
  cityCentreDriveMinutes: z.number().int().nullable(),
  accessNotes: z.string().nullable(),
  totalEventSpaceSqm: z.number().int().nullable(),
  totalEventSpaceSqft: z.number().int().nullable(),
  weddingBuyoutPolicy: hotelWeddingBuyoutPolicy.nullable(), // INTERNAL booking terms (decision 12)
  minRoomsWithoutBuyout: z.number().int().nullable(), // INTERNAL
  minNights: z.number().int().nullable(), // INTERNAL
  parallelFunctions: hotelParallelFunctions.nullable(), // INTERNAL
  bookingNotes: z.string().nullable(), // INTERNAL
  cuisines: z.array(z.string()).nullable(),
  isPureVegetarian: z.boolean().nullable(), // null: the hotel has not said
  hasSeparateVegKitchen: z.boolean().nullable(),
  servesAlcohol: z.boolean().nullable(),
};

/**
 * The D-178 field names, in one list, for the API's write and diff code.
 *
 * @example
 * HOTEL_CATALOGUE_KEYS.includes("mapsUrl"); // true
 */
export const HOTEL_CATALOGUE_KEYS = [
  "parentGroup",
  "nameAliases",
  "locality",
  "city",
  "state",
  "postalCode",
  "mapsUrl",
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
] as const satisfies readonly (keyof typeof hotelCatalogueRequestFields)[];
export type HotelCatalogueKey = (typeof HOTEL_CATALOGUE_KEYS)[number];

/**
 * The cuisine choices the staff editor offers (configuration `hotel.cuisine_options`) and the label for
 * anything else. `GET /hotels-admin/cuisine-options` returns it to every staff profile reader.
 *
 * @example
 * hotelCuisineOptionsView.parse({ options: ["Indian", "Italian"], other: "Other" });
 */
export const hotelCuisineOptionsView = z
  .object({ options: z.array(z.string()), other: z.string() })
  .strict();
export type HotelCuisineOptionsView = z.infer<typeof hotelCuisineOptionsView>;
