import { z } from "zod";

import {
  INDIA_POSTAL_CODE,
  isGoogleMapsUrl,
  MAPS_URL_MAX_LENGTH,
  normalisePostalCode,
} from "../hotel-location";
import { HOTEL_PHONE_REFUSAL, normaliseHotelPhone } from "../hotel-phone";
import { httpsWebsite, WEBSITE_MAX_LENGTH } from "../web-address";
import { storableJsonText, uuid } from "./common";
import { hotelCatalogueRequestFields } from "./hotel-catalogue";
import { VENUE_CAPACITY_MAX } from "./hotel-rooms-venues";

/*
 * The fields of the hotel form's section drafts (D-190 §2; plan §5.1 and §5.3). A draft is lenient about
 * what is missing, never about what is there: every field may be absent or null, blank text is stored as
 * null, and a filled field keeps the catalogue's bounds and the form's rules (a Google Maps link, an https
 * website, a PIN, a phone in E.164, an area with its unit). A field that breaks its rule is refused on its
 * own path, so the page shows where; text is refused when jsonb could not store it (`storableJsonText`).
 * The merge (Slice 10) reads these values; units are converted there, never here.
 */

const tooLong = (max: number): string => `Use at most ${max} characters`;

/**
 * Blank-or-formatted text: trimmed, at most `max` characters, blank as null, otherwise what `normalise`
 * makes of it, or refused with `refusal` when it makes nothing.
 */
function formatted(max: number, normalise: (text: string) => string | null, refusal: string) {
  return storableJsonText()
    .max(max, tooLong(max))
    .transform((text, ctx) => {
      if (text === "") return null;
      const value = normalise(text);
      if (value !== null) return value;
      ctx.addIssue({ code: "custom", message: refusal });
      return z.NEVER;
    })
    .nullish();
}

/**
 * Free text of a draft: trimmed, at most `max` characters (the catalogue's bound for the column it goes
 * to), blank as null.
 *
 * @example
 * z.object({ locality: hotelFormText(255) }).parse({ locality: "  " }); // { locality: null }
 */
export function hotelFormText(max: number) {
  return formatted(max, (text) => text, tooLong(max));
}

/** A phone as typed, read into E.164 by the catalogue's rule (`normaliseHotelPhone`). */
export const hotelFormPhone = formatted(64, normaliseHotelPhone, HOTEL_PHONE_REFUSAL);

const EMAIL = z.email();

/** An email address, stored lower-case, at most 255 characters (as `hotel_contacts.email`). */
export const hotelFormEmail = formatted(
  255,
  (text) => {
    const email = text.toLowerCase();
    return EMAIL.safeParse(email).success ? email : null;
  },
  "Enter an email address such as name@hotel.example",
);

/** Why a PIN is refused: the words the catalogue's `postalCodeProblem` uses. */
export const HOTEL_FORM_PIN_REFUSAL = "A PIN code is 6 digits and does not start with 0";

/** India's PIN: 6 digits, the first not 0, the spaces people type inside it dropped. */
export const hotelFormPostalCode = formatted(
  16,
  (text) => {
    const pin = normalisePostalCode(text);
    return INDIA_POSTAL_CODE.test(pin) ? pin : null;
  },
  HOTEL_FORM_PIN_REFUSAL,
);

/** A Google Maps link (`isGoogleMapsUrl`): never fetched, so a short link is never resolved. */
export const hotelFormMapsUrl = formatted(
  MAPS_URL_MAX_LENGTH,
  (text) => (isGoogleMapsUrl(text) ? text : null),
  "Use an https Google Maps link",
);

/** The hotel's official website, https only (`httpsWebsite`): typed without a scheme, it reads as https. */
export const hotelFormWebsite = formatted(
  WEBSITE_MAX_LENGTH,
  httpsWebsite,
  "Use the hotel's https address, such as https://www.hotel.example",
);

const MONTH = /^20\d{2}-(?:0[1-9]|1[0-2])$/;

/** A month, `YYYY-MM`, from 2000 to 2099: when the fact sheet was last updated. */
export const hotelFormMonth = formatted(
  32,
  (text) => (MONTH.test(text) ? text : null),
  "Give the month, such as 2026-09",
);

/** A whole number from `min` to `max`, or no answer. */
export function hotelFormCount(min: number, max: number) {
  return z
    .number({ error: "Enter a number" })
    .int({ error: "Enter a whole number" })
    .min(min, `Use ${min} or more`)
    .max(max, `Use ${max} or less`)
    .nullish();
}

/** The unit an area is given in: square feet or square metres. */
export const hotelFormAreaUnit = z.enum(["sqft", "sqm"]);
export type HotelFormAreaUnit = z.infer<typeof hotelFormAreaUnit>;

/** The largest whole area in each unit a kind of space may give, as the catalogue's columns hold it. */
export interface HotelFormAreaLimits {
  readonly sqft: number;
  readonly sqm: number;
}

/** A room's size: `size_sqft` and `size_sqm` of `hotel_room_categories`. */
export const ROOM_AREA_LIMITS: HotelFormAreaLimits = { sqft: 1_000_000, sqm: 100_000 };

/** A venue's area or pre-function area, and the total event space: the venue and hotel columns. */
export const VENUE_AREA_LIMITS: HotelFormAreaLimits = { sqft: 10_000_000, sqm: 1_000_000 };

const areaValue = (max: number) =>
  z
    .number({ error: "Enter the area" })
    .int({ error: "Give the area as a whole number" })
    .min(0, "Use 0 or more")
    .max(max, `Use ${max} or less`);

/**
 * An area as the hotel gives it: a whole number and its unit, held as given and converted to the
 * catalogue's square metres at the merge (`sqmFromSqft`, Slice 10).
 *
 * @example
 * hotelFormArea(ROOM_AREA_LIMITS).parse({ value: 450, unit: "sqft" });
 */
export function hotelFormArea(limits: HotelFormAreaLimits) {
  return z
    .discriminatedUnion("unit", [
      z.object({ unit: z.literal("sqft"), value: areaValue(limits.sqft) }).strict(),
      z.object({ unit: z.literal("sqm"), value: areaValue(limits.sqm) }).strict(),
    ])
    .nullish();
}
export type HotelFormArea = NonNullable<z.output<ReturnType<typeof hotelFormArea>>>;

const guests = z
  .number()
  .int("Give a whole number of guests")
  .min(0, "Use 0 or more")
  .max(VENUE_CAPACITY_MAX, `Use ${VENUE_CAPACITY_MAX} or less`);

/**
 * A venue's seated or floating capacity: a number of guests, or a range as a minimum and a maximum
 * (`{ min, max }`). The merge keeps the maximum in the catalogue's capacity column and the range in its
 * `capacity_notes`.
 *
 * @example
 * hotelFormCapacity.parse({ min: 250, max: 300 });
 */
export const hotelFormCapacity = z
  .union([guests, z.object({ min: guests, max: guests }).strict()], {
    error: "Give a number of guests, or a minimum and a maximum",
  })
  .refine((capacity) => typeof capacity === "number" || capacity.min <= capacity.max, {
    message: "The minimum is above the maximum",
    path: ["min"],
  })
  .nullish();
export type HotelFormCapacity = NonNullable<z.output<typeof hotelFormCapacity>>;

/**
 * A place a guest travels from (the airport, the railway station, the city centre): its name, the
 * distance in km to one decimal and the drive in minutes, as the catalogue's access columns.
 */
export const hotelFormAccessPoint = z
  .object({
    name: hotelFormText(255),
    km: hotelCatalogueRequestFields.airportDistanceKm,
    minutes: hotelCatalogueRequestFields.airportDriveMinutes,
  })
  .strict()
  .nullish();

/**
 * A room or venue row's key: a UUID the page makes when the row is added, kept while it is renamed or
 * moved, so a photo (Slice 9) and the merge name the row and never its place in the list. Kept lower-case,
 * so two ids that differ only in case are one row's, which a section refuses twice.
 */
export const hotelFormRowId = uuid.transform((id) => id.toLowerCase());
