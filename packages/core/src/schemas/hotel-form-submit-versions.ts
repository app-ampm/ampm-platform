import { z } from "zod";

import type { ErrorDetail } from "../errors";
import {
  HOTEL_FORM_SECTION_KEYS,
  hotelFormSectionKey,
  type HotelFormSectionKey,
} from "./hotel-form-section-keys";
import type { HotelFormRefusedCall } from "./hotel-form-submit";

/*
 * The section versions a submit carries (D-190, as decided after the reviews): every section's version as
 * the review page (HF-06) showed it, 0 for one never saved. Under the request's lock the API compares them
 * with the sections as they stand, so 7.4 and 7.5 are never recorded against content the submitter did not
 * see: a colleague's later save is 409 `sectionsChanged`, whose details name the sections that moved, and
 * the page reads the draft again and shows them before the person submits again.
 */

const version = z.number().int().min(0);

/**
 * Every section's version as the review page showed it (0 before a section's first save).
 *
 * @example
 * hotelFormSectionVersions.parse(hotelFormSectionVersionsOf(draft.sections));
 */
export const hotelFormSectionVersions = z
  .object({
    property: version,
    contact: version,
    rooms: version,
    venues: version,
    booking_terms: version,
    food_beverage: version,
    fact_sheet_media: version,
  })
  .strict();
export type HotelFormSectionVersions = z.infer<typeof hotelFormSectionVersions>;

/**
 * The versions of the sections a page shows, as a submit sends them: the draft's, read when the page drew.
 *
 * @example
 * const sectionVersions = hotelFormSectionVersionsOf(draft.sections);
 */
export function hotelFormSectionVersionsOf(sections: {
  readonly [K in HotelFormSectionKey]: { readonly version: number };
}): HotelFormSectionVersions {
  return {
    property: sections.property.version,
    contact: sections.contact.version,
    rooms: sections.rooms.version,
    venues: sections.venues.version,
    booking_terms: sections.booking_terms.version,
    food_beverage: sections.food_beverage.version,
    fact_sheet_media: sections.fact_sheet_media.version,
  };
}

/** The detail path of a submit's 409 `sectionsChanged`. */
export const HOTEL_FORM_SECTIONS_CHANGED_PATH = "sectionsChanged";

const changedEnvelope = z.object({ sections: z.array(hotelFormSectionKey).min(1) }).strict();

/**
 * A `sectionsChanged`'s details for the error envelope: the sections, in the form's order, whose version
 * moved since the review page read them.
 *
 * @example
 * new AppError("conflict", HOTEL_FORM_ERRORS.sectionsChanged, hotelFormSectionsChangedDetails(["contact"]));
 */
export function hotelFormSectionsChangedDetails(
  sections: readonly HotelFormSectionKey[],
): ErrorDetail[] {
  const ordered = HOTEL_FORM_SECTION_KEYS.filter((key) => sections.includes(key));
  return [
    { path: HOTEL_FORM_SECTIONS_CHANGED_PATH, message: JSON.stringify({ sections: ordered }) },
  ];
}

/**
 * The sections a refused submit says changed, or null when the error is not a `sectionsChanged`.
 *
 * @example
 * const changed = hotelFormSectionsChangedOf(error); // ["contact"]: show what moved, then submit again
 */
export function hotelFormSectionsChangedOf(
  error: HotelFormRefusedCall,
): HotelFormSectionKey[] | null {
  if (error.code !== "conflict") return null;
  const detail = error.details?.find((entry) => entry.path === HOTEL_FORM_SECTIONS_CHANGED_PATH);
  if (detail === undefined) return null;
  let json: unknown;
  try {
    json = JSON.parse(detail.message);
  } catch {
    return null;
  }
  const parsed = changedEnvelope.safeParse(json);
  return parsed.success ? parsed.data.sections : null;
}
