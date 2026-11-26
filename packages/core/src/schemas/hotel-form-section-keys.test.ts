import { describe, expect, it } from "vitest";

import { canonicalJson, utf8ByteLength } from "../canonical-json";
import {
  HOTEL_FORM_CAPS,
  HOTEL_FORM_SECTION_MAX_BYTES,
  hotelFormSectionBytes,
  isHotelFormSectionTooLarge,
} from "./hotel-form-section-keys";
import { hotelFormPropertyDraft } from "./hotel-form-sections";

/*
 * The section caps (D-190 §2): the bytes of each section's canonical JSON, and the row caps the draft
 * answers. Synthetic data only.
 */

const rowId = (n: number): string => `0192f1a0-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("the section caps", () => {
  it("are 32 KB of canonical JSON, and 96 KB for rooms and venues", () => {
    expect(HOTEL_FORM_SECTION_MAX_BYTES).toEqual({
      property: 32_768,
      contact: 32_768,
      rooms: 98_304,
      venues: 98_304,
      booking_terms: 32_768,
      food_beverage: 32_768,
      fact_sheet_media: 32_768,
    });
    expect(HOTEL_FORM_CAPS).toEqual({
      sectionMaxBytes: HOTEL_FORM_SECTION_MAX_BYTES,
      roomRows: 60,
      venueRows: 40,
      contacts: 3,
      otherLayoutsPerVenue: 12,
    });
  });

  it("measure the canonical JSON in UTF-8 bytes, blanks left out", () => {
    const answers = { name: "महल", city: null };
    expect(hotelFormSectionBytes(answers)).toBe(utf8ByteLength(canonicalJson(answers)));
    expect(hotelFormSectionBytes(answers)).toBe('{"name":""}'.length + 9);
  });

  it("tell a section over its cap, which rooms and venues reach only with far more text", () => {
    const notes = "x".repeat(10_000);
    const property32 = {
      accessNotes: notes,
      description: "y".repeat(600),
      noLongerOffered: "z".repeat(2_000),
    };
    expect(isHotelFormSectionTooLarge("property", property32)).toBe(false);
    const heavy = { accessNotes: "म".repeat(10_000), noLongerOffered: "म".repeat(2_000) };
    expect(hotelFormPropertyDraft.safeParse(heavy).success).toBe(true);
    expect(isHotelFormSectionTooLarge("property", heavy)).toBe(true);
    const rows = Array.from({ length: 10 }, (_, n) => ({ rowId: rowId(n), notes }));
    expect(isHotelFormSectionTooLarge("rooms", { rows })).toBe(true);
    expect(isHotelFormSectionTooLarge("rooms", { rows: rows.slice(0, 9) })).toBe(false);
  });
});
