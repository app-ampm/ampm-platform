import { describe, expect, it } from "vitest";

import { FACILITY_LABEL_MAX_LENGTH, FACILITY_LABELS_MAX } from "./hotels-admin";
import {
  HOTEL_FACILITY_OPTIONS,
  HOTEL_FACILITY_OTHER,
  HOTEL_STAR_CATEGORIES,
  hotelFacilityChoice,
  hotelStarCategory,
} from "./hotel-form-options";

/* The choices the hotel form's property section offers (D-190 §2): facility chips and star categories. */
describe("HOTEL_FACILITY_OPTIONS", () => {
  it("is a modest list of what weddings ask of a hotel, each once, Other kept apart", () => {
    expect(HOTEL_FACILITY_OPTIONS.length).toBeGreaterThanOrEqual(10);
    expect(HOTEL_FACILITY_OPTIONS.length).toBeLessThanOrEqual(24);
    const lower = HOTEL_FACILITY_OPTIONS.map((option) => option.toLowerCase());
    expect(new Set(lower).size).toBe(HOTEL_FACILITY_OPTIONS.length);
    expect(lower).not.toContain(HOTEL_FACILITY_OTHER.toLowerCase());
    for (const option of ["Swimming pool", "Spa", "Gym", "Parking"]) {
      expect(HOTEL_FACILITY_OPTIONS).toContain(option);
    }
  });

  it("fits the catalogue's facility labels, so a merge can copy each chip as it is", () => {
    expect(HOTEL_FACILITY_OPTIONS.length + 1).toBeLessThanOrEqual(FACILITY_LABELS_MAX);
    for (const option of [...HOTEL_FACILITY_OPTIONS, HOTEL_FACILITY_OTHER]) {
      expect(option.length).toBeLessThanOrEqual(FACILITY_LABEL_MAX_LENGTH);
      expect(option).toBe(option.trim());
    }
  });
});

describe("hotelFacilityChoice", () => {
  it("takes a listed facility or Other, exactly as written", () => {
    expect(hotelFacilityChoice.parse("Spa")).toBe("Spa");
    expect(hotelFacilityChoice.parse(HOTEL_FACILITY_OTHER)).toBe("Other");
    for (const text of ["spa", "Helipad", ""]) {
      expect(hotelFacilityChoice.safeParse(text).success, text).toBe(false);
    }
  });
});

describe("HOTEL_STAR_CATEGORIES", () => {
  it("offers the star ratings, heritage and an unrated hotel, each once", () => {
    expect(new Set(HOTEL_STAR_CATEGORIES).size).toBe(HOTEL_STAR_CATEGORIES.length);
    for (const category of ["3 star", "5 star", "5 star deluxe", "Heritage", "Not star-rated"]) {
      expect(HOTEL_STAR_CATEGORIES).toContain(category);
    }
    expect(hotelStarCategory.parse("4 star")).toBe("4 star");
    expect(hotelStarCategory.safeParse("4 stars").success).toBe(false);
  });
});
