import { describe, expect, it } from "vitest";

import { canonicalJson } from "../canonical-json";
import { HOTEL_FORM_SCHEMA_VERSIONS, HOTEL_FORM_SECTION_KEYS } from "./hotel-form-section-keys";
import { hotelFormRevisionAnswers, hotelFormRevisionAnswersOf } from "./hotel-form-revision";

/*
 * What a submitted revision holds (D-190 §1, `hotel_info_request_revisions.answers_json`): every section,
 * saved or not, with its schema version, its No changes and its answers, so the merge (Slice 10) and the
 * staff review (8b) read one shape, and the declarations bind to the SHA-256 of its canonical JSON.
 */

const saved = (answers: unknown, noChanges = false) => ({ schemaVersion: 1, noChanges, answers });

describe("hotelFormRevisionAnswersOf", () => {
  it("holds all seven sections, an unsaved one empty, each with its version and No changes", () => {
    const revision = hotelFormRevisionAnswersOf({
      property: saved({ name: " Synthetic Lake Palace ", city: "Udaipur" }),
      booking_terms: saved({}, true),
    });
    expect(Object.keys(revision)).toEqual([...HOTEL_FORM_SECTION_KEYS]);
    expect(revision.property).toEqual({
      schemaVersion: 1,
      noChanges: false,
      answers: { name: "Synthetic Lake Palace", city: "Udaipur" },
    });
    expect(revision.booking_terms.noChanges).toBe(true);
    expect(revision.rooms).toEqual({
      schemaVersion: HOTEL_FORM_SCHEMA_VERSIONS.rooms,
      noChanges: false,
      answers: {},
    });
    expect(hotelFormRevisionAnswers.parse(revision)).toEqual(revision);
  });

  it("gives one canonical JSON, so one hash, for the same answers saved in any key order", () => {
    const a = hotelFormRevisionAnswersOf({ property: saved({ name: "Palace", city: "Udaipur" }) });
    const b = hotelFormRevisionAnswersOf({ property: saved({ city: "Udaipur", name: "Palace" }) });
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    const c = hotelFormRevisionAnswersOf({ property: saved({ name: "Palace", city: "Jaipur" }) });
    expect(canonicalJson(c)).not.toBe(canonicalJson(a));
  });

  it("refuses to snapshot a section whose answers no longer read: submit names it first", () => {
    expect(() => hotelFormRevisionAnswersOf({ property: saved({ state: "Atlantis" }) })).toThrow();
  });
});
