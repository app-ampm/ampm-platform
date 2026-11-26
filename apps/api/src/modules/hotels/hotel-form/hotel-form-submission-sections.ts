import {
  AppError,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SECTION_KEYS,
  hotelFormRevisionAnswersOf,
  hotelFormSectionsChangedDetails,
  type HotelFormSavedSection,
  type HotelFormSectionKey,
  type HotelFormSectionVersions,
} from "@ampm/core";

import { wholeContentOf, type CanonicalContent } from "./hotel-form-content.js";
import type { SectionRow } from "./hotel-form-sections.repository.js";

/*
 * The saved sections as a submit reads them under the request's lock (D-190 §3), pure: against the
 * versions the review page read (a colleague's later save is 409 sectionsChanged, D-190 as decided after
 * the reviews), as submit's strict check reads them, and as the revision that keeps them whole and hashes
 * them for both declarations.
 */

/** The saved sections by key, as submit's check and a revision read them. */
export function savedSectionsOf(
  rows: readonly SectionRow[],
): Partial<Record<HotelFormSectionKey, HotelFormSavedSection>> {
  return Object.fromEntries(
    rows.map((row) => [
      row.sectionKey,
      { schemaVersion: row.schemaVersion, noChanges: row.noChanges, answers: row.answers },
    ]),
  );
}

/**
 * A revision of the saved sections (every section, saved or not) as it is kept (whole, in the shape core's
 * revision schema reads) and hashed (its canonical JSON).
 */
export function revisionOf(rows: readonly SectionRow[]): CanonicalContent {
  return wholeContentOf(hotelFormRevisionAnswersOf(savedSectionsOf(rows)));
}

/** The hash the saved sections would submit under, or null when one no longer reads. */
export function revisionHashOrNull(rows: readonly SectionRow[]): string | null {
  try {
    return revisionOf(rows).hash;
  } catch {
    return null;
  }
}

/**
 * The sections, in the form's order, whose version is not the one the review page read (0 for a section
 * it read unsaved).
 *
 * @example
 * changedSectionsOf(rows, body.sectionVersions); // ["contact"]
 */
export function changedSectionsOf(
  rows: readonly SectionRow[],
  read: HotelFormSectionVersions,
): HotelFormSectionKey[] {
  const current = new Map(rows.map((row) => [row.sectionKey, row.version]));
  return HOTEL_FORM_SECTION_KEYS.filter((key) => (current.get(key) ?? 0) !== read[key]);
}

/** 409 `sectionsChanged`: the sections a colleague saved since the review page read them. */
export function sectionsChangedRefusal(changed: readonly HotelFormSectionKey[]): AppError {
  const details = hotelFormSectionsChangedDetails(changed);
  return new AppError("conflict", HOTEL_FORM_ERRORS.sectionsChanged, details);
}
