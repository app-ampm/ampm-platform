import { z } from "zod";

import { canonicalJson, utf8ByteLength } from "../canonical-json";
import { VENUE_OTHER_LAYOUTS_MAX } from "./hotel-rooms-venues";

/*
 * The hotel form's seven sections by key, and their caps (D-190 §1 and §2; plan §4.4): the row caps and a
 * byte cap on each section's canonical JSON, which the API checks on every save and refuses over (400
 * `sectionTooLarge`, naming the cap), and the schema version each saved row records. The drafts
 * themselves are in hotel-form-sections.ts.
 */

/** The seven sections, in the form's order. */
export const HOTEL_FORM_SECTION_KEYS = [
  "property",
  "contact",
  "rooms",
  "venues",
  "booking_terms",
  "food_beverage",
  "fact_sheet_media",
] as const;

/** A section's key (`hotel_info_request_sections.section_key`; the database enum HotelFormSectionKey). */
export const hotelFormSectionKey = z.enum(HOTEL_FORM_SECTION_KEYS);
export type HotelFormSectionKey = z.infer<typeof hotelFormSectionKey>;

/** The most room rows, venue rows and contacts a draft holds; a venue's other layouts stop at 12. */
export const HOTEL_FORM_ROOM_ROWS_MAX = 60;
export const HOTEL_FORM_VENUE_ROWS_MAX = 40;
export const HOTEL_FORM_CONTACTS_MAX = 3;

/** The longest description and refresh note, and the text an Other chip carries. */
export const HOTEL_FORM_DESCRIPTION_MAX = 600;
export const HOTEL_FORM_NOTE_MAX = 2_000;
export const HOTEL_FORM_OTHER_TEXT_MAX = 500;

const KIB = 1024;

/** A section's cap: UTF-8 bytes of its canonical JSON, 32 KB, and 96 KB for rooms and venues. */
export const HOTEL_FORM_SECTION_MAX_BYTES: Readonly<Record<HotelFormSectionKey, number>> = {
  property: 32 * KIB,
  contact: 32 * KIB,
  rooms: 96 * KIB,
  venues: 96 * KIB,
  booking_terms: 32 * KIB,
  food_beverage: 32 * KIB,
  fact_sheet_media: 32 * KIB,
};

/** Every cap in one place, as `GET /hotel-form/draft` answers them. */
export const HOTEL_FORM_CAPS = {
  sectionMaxBytes: HOTEL_FORM_SECTION_MAX_BYTES,
  roomRows: HOTEL_FORM_ROOM_ROWS_MAX,
  venueRows: HOTEL_FORM_VENUE_ROWS_MAX,
  contacts: HOTEL_FORM_CONTACTS_MAX,
  otherLayoutsPerVenue: VENUE_OTHER_LAYOUTS_MAX,
} as const;

/**
 * The shape each section's answers have (`hotel_info_request_sections.schema_version`), written on every
 * save. A change that would refuse saved answers is a new version, with its reading of the old ones.
 */
export const HOTEL_FORM_SCHEMA_VERSIONS: Readonly<Record<HotelFormSectionKey, number>> = {
  property: 1,
  contact: 1,
  rooms: 1,
  venues: 1,
  booking_terms: 1,
  food_beverage: 1,
  fact_sheet_media: 1,
};

/**
 * How many bytes a section's answers take against its cap: the UTF-8 of their canonical JSON.
 *
 * @example
 * hotelFormSectionBytes({ name: "Synthetic Lake Palace" }); // 32
 */
export function hotelFormSectionBytes(answers: unknown): number {
  return utf8ByteLength(canonicalJson(answers));
}

/**
 * Whether a section's answers are over its cap ({@link HOTEL_FORM_SECTION_MAX_BYTES}): the API refuses
 * such a save with 400 `sectionTooLarge`, naming the cap.
 *
 * @example
 * isHotelFormSectionTooLarge("rooms", draft); // false
 */
export function isHotelFormSectionTooLarge(key: HotelFormSectionKey, answers: unknown): boolean {
  return hotelFormSectionBytes(answers) > HOTEL_FORM_SECTION_MAX_BYTES[key];
}
