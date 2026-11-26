import { z } from "zod";

import { isWellFormedText, LONE_SURROGATE_MESSAGE, storableJsonText } from "./common";
import { HOTEL_CUISINES_MAX, hotelCatalogueRequestFields } from "./hotel-catalogue";
import {
  hotelFormAccessPoint,
  hotelFormArea,
  hotelFormCapacity,
  hotelFormCount,
  hotelFormEmail,
  hotelFormMapsUrl,
  hotelFormMonth,
  hotelFormPhone,
  hotelFormPostalCode,
  hotelFormRowId,
  hotelFormText,
  hotelFormWebsite,
  ROOM_AREA_LIMITS,
  VENUE_AREA_LIMITS,
} from "./hotel-form-fields";
import {
  HOTEL_FACILITY_OPTIONS,
  hotelFacilityChoice,
  hotelStarCategory,
} from "./hotel-form-options";
import {
  HOTEL_FORM_CONTACTS_MAX,
  HOTEL_FORM_DESCRIPTION_MAX,
  HOTEL_FORM_NOTE_MAX,
  HOTEL_FORM_OTHER_TEXT_MAX,
  HOTEL_FORM_ROOM_ROWS_MAX,
  HOTEL_FORM_VENUE_ROWS_MAX,
  type HotelFormSectionKey,
} from "./hotel-form-section-keys";
import {
  hotelRoomUnitType,
  hotelVenueSetting,
  VENUE_CAPACITY_MAX,
  venueCatalogueRequestFields,
  venueOtherLayouts,
} from "./hotel-rooms-venues";
import { hotelVenueType } from "./hotels";
import { indianState } from "./indian-states";

/*
 * The hotel form's seven sections (D-190 §1 and §2; plan §4.4 and §5.1), each saved as one draft row
 * (`hotel_info_request_sections`). A draft is a strict object (an unknown key is refused) whose every
 * field may be absent or null; the field rules are in hotel-form-fields.ts, and what submit needs is in
 * hotel-form-submit.ts. Every section takes the refresh note "Anything no longer offered or renamed?"
 * (`noLongerOffered`); "No changes since last time" is the row's `no_changes`, sent beside the answers.
 * Text keeps the catalogue's bound for the column it goes to. A section's canonical JSON is capped in
 * bytes, and the rows are capped in number (hotel-form-section-keys.ts).
 */

/** "Anything no longer offered or renamed?": a refresh request's note, on every section. */
const noLongerOffered = hotelFormText(HOTEL_FORM_NOTE_MAX);

const distinct = (values: readonly string[]): boolean => new Set(values).size === values.length;
const distinctIgnoringCase = (values: readonly string[]): boolean =>
  distinct(values.map((value) => value.toLowerCase()));
const distinctRowIds = (rows: readonly { readonly rowId: string }[]): boolean =>
  distinct(rows.map((row) => row.rowId));

/** Property and location (plan §5.1, 1.1 to 1.6, 1.9, 1.10 and the new questions). */
export const hotelFormPropertyDraft = z
  .object({
    name: hotelFormText(255),
    isChain: z.boolean().nullish(),
    groupName: hotelFormText(255),
    street: hotelFormText(500),
    locality: hotelFormText(255),
    city: hotelFormText(255),
    state: indianState.nullish(),
    postalCode: hotelFormPostalCode,
    mapsUrl: hotelFormMapsUrl,
    website: hotelFormWebsite,
    airport: hotelFormAccessPoint,
    railwayStation: hotelFormAccessPoint,
    cityCentre: hotelFormAccessPoint,
    accessNotes: hotelFormText(10_000),
    starCategory: hotelStarCategory.nullish(),
    description: hotelFormText(HOTEL_FORM_DESCRIPTION_MAX),
    facilities: z
      .array(hotelFacilityChoice)
      .max(HOTEL_FACILITY_OPTIONS.length + 1)
      .refine(distinct, "Choose each facility once")
      .nullish(),
    facilitiesOther: hotelFormText(HOTEL_FORM_OTHER_TEXT_MAX),
    noLongerOffered,
  })
  .strict();
export type HotelFormPropertyDraft = z.output<typeof hotelFormPropertyDraft>;

/** One contact for weddings and events; the page fills "Same as me" from the person's own details. */
export const hotelFormContactRow = z
  .object({
    name: hotelFormText(255),
    role: hotelFormText(255),
    phone: hotelFormPhone,
    email: hotelFormEmail,
  })
  .strict();
export type HotelFormContactRow = z.output<typeof hotelFormContactRow>;

/** Contact for weddings and events (1.7 and 1.8): up to 3 contacts. */
export const hotelFormContactDraft = z
  .object({
    contacts: z
      .array(hotelFormContactRow)
      .max(HOTEL_FORM_CONTACTS_MAX, `At most ${HOTEL_FORM_CONTACTS_MAX} contacts`)
      .nullish(),
    noLongerOffered,
  })
  .strict();
export type HotelFormContactDraft = z.output<typeof hotelFormContactDraft>;

/** One room category: `hotel_room_categories` at the merge (`notes` is its description). */
export const hotelFormRoomRow = z
  .object({
    rowId: hotelFormRowId,
    name: hotelFormText(255),
    roomCount: hotelFormCount(0, 100_000),
    unitType: hotelRoomUnitType.nullish(),
    size: hotelFormArea(ROOM_AREA_LIMITS),
    maxOccupancy: hotelFormCount(1, 100),
    viewLabel: hotelFormText(255),
    bedConfiguration: hotelFormText(255),
    notes: hotelFormText(10_000),
  })
  .strict();
export type HotelFormRoomRow = z.output<typeof hotelFormRoomRow>;

/** Rooms (2.1 and the room table): the total and up to 60 rows. */
export const hotelFormRoomsDraft = z
  .object({
    totalRooms: hotelFormCount(0, 100_000),
    rows: z
      .array(hotelFormRoomRow)
      .max(HOTEL_FORM_ROOM_ROWS_MAX, `At most ${HOTEL_FORM_ROOM_ROWS_MAX} room rows`)
      .refine(distinctRowIds, "Give each row its own id")
      .nullish(),
    noLongerOffered,
  })
  .strict();
export type HotelFormRoomsDraft = z.output<typeof hotelFormRoomsDraft>;

/** A venue's other layouts, as the catalogue keeps them (at most 12), in text jsonb can store. */
const hotelFormOtherLayouts = venueOtherLayouts
  .refine((layouts) => layouts.every((entry) => isWellFormedText(entry.layout)), {
    message: LONE_SURROGATE_MESSAGE,
  })
  .nullish();

/**
 * One venue: `hotel_venues` at the merge. Seated is a dinner at round tables (`capacity_banquet`),
 * floating a standing reception or cocktails (`capacity_reception`), decision 11; `notes` is its
 * description. The venue type is asked but not required: the reviewer settles it at the merge.
 */
export const hotelFormVenueRow = z
  .object({
    rowId: hotelFormRowId,
    name: hotelFormText(255),
    setting: hotelVenueSetting.nullish(),
    venueType: hotelVenueType.nullish(),
    area: hotelFormArea(VENUE_AREA_LIMITS),
    seated: hotelFormCapacity,
    floating: hotelFormCapacity,
    theatre: hotelFormCount(0, VENUE_CAPACITY_MAX),
    otherLayouts: hotelFormOtherLayouts,
    lengthM: venueCatalogueRequestFields.lengthM,
    widthM: venueCatalogueRequestFields.widthM,
    ceilingHeightM: venueCatalogueRequestFields.ceilingHeightM,
    prefunctionArea: hotelFormArea(VENUE_AREA_LIMITS),
    notes: hotelFormText(10_000),
  })
  .strict();
export type HotelFormVenueRow = z.output<typeof hotelFormVenueRow>;

/** Venues (the venue table and the total event space): up to 40 rows. */
export const hotelFormVenuesDraft = z
  .object({
    totalEventSpace: hotelFormArea(VENUE_AREA_LIMITS),
    rows: z
      .array(hotelFormVenueRow)
      .max(HOTEL_FORM_VENUE_ROWS_MAX, `At most ${HOTEL_FORM_VENUE_ROWS_MAX} venue rows`)
      .refine(distinctRowIds, "Give each row its own id")
      .nullish(),
    noLongerOffered,
  })
  .strict();
export type HotelFormVenuesDraft = z.output<typeof hotelFormVenuesDraft>;

/** Booking terms (2.3 and 4.1 asked once, 4.2, 4.3): INTERNAL in the catalogue (decision 12). */
export const hotelFormBookingTermsDraft = z
  .object({
    weddingBuyoutPolicy: hotelCatalogueRequestFields.weddingBuyoutPolicy,
    minRoomsWithoutBuyout: hotelFormCount(0, 10_000),
    minNights: hotelFormCount(1, 60),
    parallelFunctions: hotelCatalogueRequestFields.parallelFunctions,
    notes: hotelFormText(10_000),
    noLongerOffered,
  })
  .strict();
export type HotelFormBookingTermsDraft = z.output<typeof hotelFormBookingTermsDraft>;

/**
 * Food and beverage (5.2 and the new Yes or No facts). Cuisines are labels from configuration
 * `hotel.cuisine_options` or Other, as the catalogue keeps them (at most 30 of 1 to 60 characters, each
 * once ignoring case); the menus are uploads (Slice 9).
 */
export const hotelFormFoodBeverageDraft = z
  .object({
    cuisines: z
      .array(storableJsonText().min(1).max(60))
      .max(HOTEL_CUISINES_MAX)
      .refine(distinctIgnoringCase, "Give each cuisine once")
      .nullish(),
    cuisinesOther: hotelFormText(HOTEL_FORM_OTHER_TEXT_MAX),
    isPureVegetarian: z.boolean().nullish(),
    hasSeparateVegKitchen: z.boolean().nullish(),
    servesAlcohol: z.boolean().nullish(),
    noLongerOffered,
  })
  .strict();
export type HotelFormFoodBeverageDraft = z.output<typeof hotelFormFoodBeverageDraft>;

/** Fact sheet and media: when the fact sheet was last updated; the uploads arrive in Slice 9. */
export const hotelFormFactSheetMediaDraft = z
  .object({ factSheetAsOf: hotelFormMonth, noLongerOffered })
  .strict();
export type HotelFormFactSheetMediaDraft = z.output<typeof hotelFormFactSheetMediaDraft>;

/**
 * Each section's draft schema, by key: what `PUT /hotel-form/draft/sections/:sectionKey` parses.
 *
 * @example
 * HOTEL_FORM_SECTION_DRAFTS[key].safeParse(body.answers);
 */
export const HOTEL_FORM_SECTION_DRAFTS = {
  property: hotelFormPropertyDraft,
  contact: hotelFormContactDraft,
  rooms: hotelFormRoomsDraft,
  venues: hotelFormVenuesDraft,
  booking_terms: hotelFormBookingTermsDraft,
  food_beverage: hotelFormFoodBeverageDraft,
  fact_sheet_media: hotelFormFactSheetMediaDraft,
} as const satisfies Record<HotelFormSectionKey, z.ZodType>;

/** Each section's answers as a saved draft holds them. */
export type HotelFormSectionAnswers = {
  readonly [K in HotelFormSectionKey]: z.output<(typeof HOTEL_FORM_SECTION_DRAFTS)[K]>;
};

/** Each section's answers as the page writes them, before the drafts trim and normalise. */
export type HotelFormSectionAnswersInput = {
  readonly [K in HotelFormSectionKey]: z.input<(typeof HOTEL_FORM_SECTION_DRAFTS)[K]>;
};
