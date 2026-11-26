import { describe, expect, it } from "vitest";

import { HOTEL_FORM_SECTION_KEYS } from "./hotel-form-section-keys";
import { isHotelFormSectionComplete } from "./hotel-form-submit";

/*
 * When a section counts as complete (D-190 §2 and its amendments): every question AMPM's PDF asks in it
 * answered, no pair half-filled, or marked "No changes"; the fact sheet section always, until Slice 9.
 * Synthetic data only.
 */

const rowId = (n: number): string => `0192f1a0-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("isHotelFormSectionComplete", () => {
  it("counts a section complete when every question of AMPM's PDF in it is answered", () => {
    const property = {
      name: "Synthetic Lake Palace",
      isChain: false,
      street: "1 Lake Road",
      city: "Udaipur",
      state: "Rajasthan",
      postalCode: "313001",
      mapsUrl: "https://maps.app.goo.gl/AbC123xyz",
      website: "https://synthetic-lake-palace.example",
      airport: { km: 22.5 },
      railwayStation: { km: 4 },
    };
    expect(isHotelFormSectionComplete("property", property, false)).toBe(true);
    expect(isHotelFormSectionComplete("property", { ...property, isChain: true }, false)).toBe(
      false,
    );
    expect(
      isHotelFormSectionComplete(
        "property",
        { ...property, isChain: true, groupName: "Group" },
        false,
      ),
    ).toBe(true);
    expect(
      isHotelFormSectionComplete("property", { ...property, railwayStation: null }, false),
    ).toBe(false);
  });

  it("wants a full contact, full room and venue rows, the booking terms and a cuisine", () => {
    const contact = { contacts: [{ name: "S", phone: "0294 242 0000", email: "s@hotel.example" }] };
    expect(isHotelFormSectionComplete("contact", contact, false)).toBe(true);
    expect(
      isHotelFormSectionComplete(
        "contact",
        { contacts: [{ name: "S", email: "s@x.example" }] },
        false,
      ),
    ).toBe(false);
    const room = {
      rowId: rowId(1),
      name: "Suite",
      roomCount: 4,
      size: { value: 50, unit: "sqm" },
      maxOccupancy: 2,
    };
    expect(
      isHotelFormSectionComplete(
        "rooms",
        { totalRooms: 4, rows: [room, { rowId: rowId(2) }] },
        false,
      ),
    ).toBe(true);
    expect(
      isHotelFormSectionComplete(
        "rooms",
        { totalRooms: 4, rows: [{ ...room, size: null }] },
        false,
      ),
    ).toBe(false);
    expect(isHotelFormSectionComplete("rooms", { totalRooms: 4 }, false)).toBe(false);
    const venue = {
      rowId: rowId(3),
      name: "Lawn",
      setting: "outdoor",
      area: { value: 900, unit: "sqm" },
      seated: { min: 250, max: 300 },
      floating: 600,
    };
    expect(isHotelFormSectionComplete("venues", { rows: [venue] }, false)).toBe(true);
    expect(
      isHotelFormSectionComplete("venues", { rows: [{ ...venue, floating: null }] }, false),
    ).toBe(false);
    expect(
      isHotelFormSectionComplete("venues", { rows: [{ ...venue, seated: null }] }, false),
    ).toBe(false);
    const terms = { weddingBuyoutPolicy: "required", minNights: 2, parallelFunctions: "depends" };
    expect(isHotelFormSectionComplete("booking_terms", terms, false)).toBe(true);
    expect(
      isHotelFormSectionComplete(
        "booking_terms",
        { ...terms, weddingBuyoutPolicy: "depends" },
        false,
      ),
    ).toBe(false);
    expect(
      isHotelFormSectionComplete(
        "booking_terms",
        { ...terms, weddingBuyoutPolicy: "depends", minRoomsWithoutBuyout: 30 },
        false,
      ),
    ).toBe(true);
    expect(isHotelFormSectionComplete("food_beverage", { cuisines: ["Indian"] }, false)).toBe(true);
    expect(isHotelFormSectionComplete("food_beverage", { servesAlcohol: true }, false)).toBe(false);
  });

  it("counts a section with a half-filled pair incomplete, however full the rest", () => {
    const room = {
      rowId: rowId(1),
      name: "Suite",
      roomCount: 4,
      size: { value: 50, unit: "sqm" },
      maxOccupancy: 2,
    };
    const rooms = (size: object) => ({ totalRooms: 4, rows: [{ ...room, size }] });
    expect(isHotelFormSectionComplete("rooms", rooms({ value: 50, unit: "sqm" }), false)).toBe(
      true,
    );
    expect(isHotelFormSectionComplete("rooms", rooms({ unit: "sqm" }), false)).toBe(false);
    const venue = {
      rowId: rowId(2),
      name: "Lawn",
      setting: "outdoor",
      area: { value: 900, unit: "sqm" },
      seated: 300,
      floating: 600,
    };
    const venues = (patch: object) => ({ rows: [{ ...venue, ...patch }] });
    expect(isHotelFormSectionComplete("venues", venues({}), false)).toBe(true);
    for (const patch of [
      { seated: { min: 250 } },
      { floating: { max: 600 } },
      { area: { unit: "sqm" } },
      { prefunctionArea: { unit: "sqft" } },
      { otherLayouts: [{ layout: "U-shape" }] },
    ]) {
      expect(
        isHotelFormSectionComplete("venues", venues(patch), false),
        JSON.stringify(patch),
      ).toBe(false);
    }
    const total = { ...venues({}), totalEventSpace: { unit: "sqft" } };
    expect(isHotelFormSectionComplete("venues", total, false)).toBe(false);
  });

  it("never counts the fact sheet section incomplete before its uploads, and No changes as complete", () => {
    expect(isHotelFormSectionComplete("fact_sheet_media", {}, false)).toBe(true);
    for (const key of HOTEL_FORM_SECTION_KEYS) {
      expect(isHotelFormSectionComplete(key, {}, true), key).toBe(true);
    }
    expect(isHotelFormSectionComplete("rooms", {}, false)).toBe(false);
  });

  it("counts answers that no longer read as incomplete, even marked No changes", () => {
    expect(isHotelFormSectionComplete("food_beverage", { cuisines: "Indian" }, false)).toBe(false);
    expect(isHotelFormSectionComplete("food_beverage", { cuisines: "Indian" }, true)).toBe(false);
  });
});
