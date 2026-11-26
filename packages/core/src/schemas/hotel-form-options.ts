import { z } from "zod";

/*
 * The fixed choices of the hotel form's property section (D-190 §2; plan §5.1): the facility chips, with
 * Other for anything else, and the star categories. Unlike the cuisines (configuration
 * `hotel.cuisine_options`), they are code, so a stored answer is checked against them on every save. A
 * new choice is a new entry; renaming or removing one needs a new section `schema_version`, since saved
 * answers keep the old words. The merge copies a chosen facility into the catalogue's free-text
 * `facilities_json` as it is (Slice 10).
 */

/**
 * The facilities a wedding usually asks a hotel about, as chips. Other is {@link HOTEL_FACILITY_OTHER};
 * what it means goes in the section's own text.
 *
 * @example
 * HOTEL_FACILITY_OPTIONS.includes("Spa"); // true
 */
export const HOTEL_FACILITY_OPTIONS = [
  "Swimming pool",
  "Spa",
  "Gym",
  "Salon",
  "Parking",
  "Valet parking",
  "Wi-Fi",
  "Restaurant",
  "Bar",
  "Room service",
  "Bridal suite",
  "Kids' club",
  "Airport transfers",
  "Power backup",
  "Wheelchair access",
  "Business centre",
] as const;
export type HotelFacilityOption = (typeof HOTEL_FACILITY_OPTIONS)[number];

/** The chip for a facility the list leaves out, as the cuisines' Other (`HOTEL_CUISINE_OTHER`). */
export const HOTEL_FACILITY_OTHER = "Other";

/**
 * One chosen facility chip: a listed one, or Other.
 *
 * @example
 * hotelFacilityChoice.parse("Parking"); // "Parking"
 */
export const hotelFacilityChoice = z.enum([...HOTEL_FACILITY_OPTIONS, HOTEL_FACILITY_OTHER], {
  error: "Choose a facility from the list, or Other",
});
export type HotelFacilityChoice = z.infer<typeof hotelFacilityChoice>;

/**
 * The star categories the property section offers (the plan's "star category from a list"), the
 * catalogue's free-text `star_category` taking the chosen words at the merge.
 */
export const HOTEL_STAR_CATEGORIES = [
  "1 star",
  "2 star",
  "3 star",
  "4 star",
  "5 star",
  "5 star deluxe",
  "Heritage",
  "Not star-rated",
] as const;
export type HotelStarCategory = (typeof HOTEL_STAR_CATEGORIES)[number];

/**
 * A star category from {@link HOTEL_STAR_CATEGORIES}.
 *
 * @example
 * hotelStarCategory.parse("5 star deluxe"); // "5 star deluxe"
 */
export const hotelStarCategory = z.enum(HOTEL_STAR_CATEGORIES, {
  error: "Choose the star category from the list",
});
