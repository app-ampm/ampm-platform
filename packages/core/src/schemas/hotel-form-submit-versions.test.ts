import { describe, expect, it } from "vitest";

import { AppError } from "../errors";
import { HOTEL_FORM_ERRORS } from "./hotel-form-refusals";
import { HOTEL_FORM_SECTION_KEYS } from "./hotel-form-section-keys";
import {
  HOTEL_FORM_SECTIONS_CHANGED_PATH,
  hotelFormSectionsChangedDetails,
  hotelFormSectionsChangedOf,
  hotelFormSectionVersions,
  hotelFormSectionVersionsOf,
} from "./hotel-form-submit-versions";

/*
 * The section versions a submit carries (D-190, as decided after the reviews): the versions the review
 * page showed, every section's (0 for one never saved), so a colleague's later save is refused with 409
 * sectionsChanged naming the sections, never declared accurate unseen. Synthetic data only.
 */

const VERSIONS = {
  property: 3,
  contact: 1,
  rooms: 0,
  venues: 0,
  booking_terms: 2,
  food_beverage: 0,
  fact_sheet_media: 0,
};

describe("hotelFormSectionVersions", () => {
  it("takes every section's version, 0 for one never saved", () => {
    expect(hotelFormSectionVersions.parse(VERSIONS)).toEqual(VERSIONS);
    const { rooms: _rooms, ...six } = VERSIONS;
    expect(hotelFormSectionVersions.safeParse(six).success).toBe(false);
    expect(hotelFormSectionVersions.safeParse({ ...VERSIONS, rooms: -1 }).success).toBe(false);
    expect(hotelFormSectionVersions.safeParse({ ...VERSIONS, rooms: 1.5 }).success).toBe(false);
    expect(hotelFormSectionVersions.safeParse({ ...VERSIONS, menus: 1 }).success).toBe(false);
  });

  it("reads them off the draft the review page shows", () => {
    const at = (version: number) => ({ version, isComplete: false });
    const sections = {
      property: at(3),
      contact: at(1),
      rooms: at(0),
      venues: at(0),
      booking_terms: at(2),
      food_beverage: at(0),
      fact_sheet_media: at(0),
    };
    expect(hotelFormSectionVersionsOf(sections)).toEqual(VERSIONS);
    expect(Object.keys(hotelFormSectionVersionsOf(sections))).toEqual([...HOTEL_FORM_SECTION_KEYS]);
  });
});

describe("409 sectionsChanged", () => {
  it("carries the sections a colleague changed since the page read them, which the page reads back", () => {
    const details = hotelFormSectionsChangedDetails(["contact", "rooms"]);
    expect(details).toHaveLength(1);
    expect(details[0]?.path).toBe(HOTEL_FORM_SECTIONS_CHANGED_PATH);
    const error = new AppError("conflict", HOTEL_FORM_ERRORS.sectionsChanged, details);
    expect(hotelFormSectionsChangedOf(error)).toEqual(["contact", "rooms"]);
  });

  it("reads nothing from another error, a broken detail or a section it does not know", () => {
    const details = hotelFormSectionsChangedDetails(["contact"]);
    expect(hotelFormSectionsChangedOf({ code: "validation_failed", details })).toBeNull();
    expect(hotelFormSectionsChangedOf({ code: "conflict" })).toBeNull();
    const broken = [{ path: HOTEL_FORM_SECTIONS_CHANGED_PATH, message: "{not json" }];
    expect(hotelFormSectionsChangedOf({ code: "conflict", details: broken })).toBeNull();
    const unknown = [{ path: HOTEL_FORM_SECTIONS_CHANGED_PATH, message: '{"sections":["menus"]}' }];
    expect(hotelFormSectionsChangedOf({ code: "conflict", details: unknown })).toBeNull();
  });

  it("says what happened and what to do, apart from the form's other refusals", () => {
    expect(HOTEL_FORM_ERRORS.sectionsChanged).toMatch(/changed/i);
    expect(HOTEL_FORM_ERRORS.sectionsChanged).not.toBe(HOTEL_FORM_ERRORS.sectionConflict);
    expect(HOTEL_FORM_ERRORS.sectionsChanged).not.toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
  });
});
