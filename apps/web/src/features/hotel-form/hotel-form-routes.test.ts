import { HOTEL_FORM_SECTION_KEYS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { isHotelFormPath } from "@/middleware";

import {
  HOTEL_FORM_ROUTES,
  innerPathOf,
  nextSectionOf,
  sectionKeyOf,
  sectionPath,
} from "./hotel-form-routes";

/* The hotel form's pages (D-190 §5): where each lives, and which may be returned to after a new sign-in. */

describe("the form's pages", () => {
  it("live under /hotel-form, where the form's headers and CSP apply", () => {
    const pages = [
      HOTEL_FORM_ROUTES.identity,
      HOTEL_FORM_ROUTES.overview,
      HOTEL_FORM_ROUTES.review,
      HOTEL_FORM_ROUTES.status,
      ...HOTEL_FORM_SECTION_KEYS.map(sectionPath),
    ];
    for (const page of pages) expect(isHotelFormPath(page)).toBe(true);
    expect(sectionPath("food_beverage")).toBe("/hotel-form/sections/food_beverage");
  });

  it("read a section's key from the address, and nothing else", () => {
    expect(sectionKeyOf("rooms")).toBe("rooms");
    expect(sectionKeyOf("Rooms")).toBeNull();
    expect(sectionKeyOf("constructor")).toBeNull();
    expect(sectionKeyOf("")).toBeNull();
  });

  it("go from one section to the next, the last leading to Review and submit", () => {
    expect(nextSectionOf("property")).toBe("contact");
    expect(nextSectionOf("food_beverage")).toBe("fact_sheet_media");
    expect(nextSectionOf("fact_sheet_media")).toBeNull();
  });
});

describe("a page to come back to after signing in", () => {
  it("is one of the form's own pages behind the sign-in", () => {
    expect(innerPathOf("/hotel-form/overview")).toBe("/hotel-form/overview");
    expect(innerPathOf("/hotel-form/sections/venues")).toBe("/hotel-form/sections/venues");
    expect(innerPathOf("/hotel-form/review")).toBe("/hotel-form/review");
    expect(innerPathOf("/hotel-form/status")).toBe("/hotel-form/status");
  });

  it("is never the sign-in itself, an unknown section or a page elsewhere", () => {
    for (const path of [
      null,
      "/hotel-form",
      "/hotel-form/sections/spa",
      "/hotel-form/overview?next=//evil.example",
      "https://evil.example/hotel-form/overview",
      "//evil.example/hotel-form/overview",
      "/contact",
    ])
      expect(innerPathOf(path)).toBeNull();
  });
});
