import { z } from "zod";

import { errors } from "../errors";
import { HOTEL_FORM_SCHEMA_VERSIONS, type HotelFormSectionKey } from "./hotel-form-section-keys";
import { HOTEL_FORM_SECTION_DRAFTS, type HotelFormSectionAnswers } from "./hotel-form-sections";

/*
 * What a submitted revision holds (D-190 §1; `hotel_info_request_revisions.answers_json`): every one of
 * the seven sections, saved or not, with the schema version its answers follow, its "No changes" and its
 * answers as the section's draft reads them. One shape for the staff review (8b) and the merge (Slice 10);
 * the API stores it with `answers_hash`, the SHA-256 of its canonical JSON (`canonicalJson`), which both
 * declarations bind to.
 */

/** One section as a revision keeps it. */
function revisionSection<K extends HotelFormSectionKey>(key: K) {
  return z
    .object({
      schemaVersion: z.number().int().min(1),
      noChanges: z.boolean(),
      answers: HOTEL_FORM_SECTION_DRAFTS[key],
    })
    .strict();
}

/** A revision's answers: all seven sections. */
export const hotelFormRevisionAnswers = z
  .object({
    property: revisionSection("property"),
    contact: revisionSection("contact"),
    rooms: revisionSection("rooms"),
    venues: revisionSection("venues"),
    booking_terms: revisionSection("booking_terms"),
    food_beverage: revisionSection("food_beverage"),
    fact_sheet_media: revisionSection("fact_sheet_media"),
  })
  .strict();
export type HotelFormRevisionAnswers = z.infer<typeof hotelFormRevisionAnswers>;

/** One saved section as the API reads it: its row's schema version, No changes and stored answers. */
export interface HotelFormSavedSection {
  readonly schemaVersion: number;
  readonly noChanges: boolean;
  readonly answers: unknown;
}

const DRAFTS: { readonly [K in HotelFormSectionKey]: z.ZodType<HotelFormSectionAnswers[K]> } =
  HOTEL_FORM_SECTION_DRAFTS;

function snapshot<K extends HotelFormSectionKey>(key: K, saved: HotelFormSavedSection | undefined) {
  const answers = DRAFTS[key].safeParse(saved?.answers ?? {});
  if (!answers.success) throw errors.internal(`The ${key} section no longer reads`);
  return {
    schemaVersion: saved?.schemaVersion ?? HOTEL_FORM_SCHEMA_VERSIONS[key],
    noChanges: saved?.noChanges ?? false,
    answers: answers.data,
  };
}

/**
 * A revision's answers from a request's saved sections (one never saved is empty, at the current schema
 * version). Throws when a section's answers no longer read: `checkSubmit` names such a section first.
 *
 * @example
 * const answers = hotelFormRevisionAnswersOf(sectionsByKey);
 * const answersHash = createHash("sha256").update(canonicalJson(answers)).digest("hex");
 */
export function hotelFormRevisionAnswersOf(
  sections: Partial<Readonly<Record<HotelFormSectionKey, HotelFormSavedSection>>>,
): HotelFormRevisionAnswers {
  return {
    property: snapshot("property", sections.property),
    contact: snapshot("contact", sections.contact),
    rooms: snapshot("rooms", sections.rooms),
    venues: snapshot("venues", sections.venues),
    booking_terms: snapshot("booking_terms", sections.booking_terms),
    food_beverage: snapshot("food_beverage", sections.food_beverage),
    fact_sheet_media: snapshot("fact_sheet_media", sections.fact_sheet_media),
  };
}
