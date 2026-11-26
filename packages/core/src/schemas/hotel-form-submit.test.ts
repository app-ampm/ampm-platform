import { describe, expect, it } from "vitest";

import { AppError } from "../errors";
import { HOTEL_FORM_SECTION_KEYS } from "./hotel-form-section-keys";
import {
  checkSubmit,
  hotelFormMissingItemDetails,
  hotelFormMissingItemsOf,
  isHotelFormSectionComplete,
  type HotelFormMissingItem,
} from "./hotel-form-submit";

/*
 * What submitting needs (D-190 §2; plan §4.4): on an onboarding request the hotel's name, city and state
 * and a contact with an email or a phone; on any request a name for every row that holds an answer.
 * Empty sections only warn, through each section's completeness. Synthetic data only.
 */

const rowId = (n: number): string => `0192f1a0-0000-4000-8000-${String(n).padStart(12, "0")}`;
const state = (answers: object, noChanges = false) => ({ answers, noChanges });

const ready = {
  property: state({ name: "Synthetic Lake Palace", city: "Udaipur", state: "Rajasthan" }),
  contact: state({ contacts: [{ name: "Synthetic Sales", email: "sales@hotel.example" }] }),
};

const fieldsOf = (items: readonly HotelFormMissingItem[]): string[] =>
  items.map((item) => [item.section, item.field].filter((part) => part !== null).join("."));

describe("checkSubmit", () => {
  it("passes an onboarding request with the name, city, state and a contact to reach", () => {
    expect(checkSubmit({ kind: "onboarding", sections: ready })).toEqual([]);
    const phoneOnly = state({ contacts: [{ name: "Synthetic Desk", phone: "0294 242 0000" }] });
    expect(checkSubmit({ kind: "onboarding", sections: { ...ready, contact: phoneOnly } })).toEqual(
      [],
    );
  });

  it("lists every missing item of an empty onboarding request, by section and field", () => {
    expect(checkSubmit({ kind: "onboarding", sections: {} })).toEqual([
      { section: "property", field: "name", message: "Enter the hotel's name" },
      { section: "property", field: "city", message: "Enter the city" },
      { section: "property", field: "state", message: "Choose the state" },
      {
        section: "contact",
        field: "contacts",
        message: "Add a contact with an email or a phone number",
      },
    ]);
  });

  it("wants a contact reachable by email or phone, and a name on every contact that has an answer", () => {
    const contact = state({
      contacts: [
        { name: "Synthetic Sales", role: "Sales Manager" },
        {},
        { email: "x@hotel.example" },
      ],
    });
    expect(fieldsOf(checkSubmit({ kind: "onboarding", sections: { ...ready, contact } }))).toEqual([
      "contact.contacts.2.name",
    ]);
    const unreachable = state({ contacts: [{ name: "Synthetic Sales" }] });
    expect(
      fieldsOf(checkSubmit({ kind: "onboarding", sections: { ...ready, contact: unreachable } })),
    ).toEqual(["contact.contacts"]);
  });

  it("wants a name on every room and venue row that holds an answer, and skips a blank row", () => {
    const rooms = state({ rows: [{ rowId: rowId(1) }, { rowId: rowId(2), roomCount: 4 }] });
    const venues = state({
      rows: [
        { rowId: rowId(3), name: "Lawn" },
        { rowId: rowId(4), floating: 90 },
      ],
    });
    const items = checkSubmit({ kind: "onboarding", sections: { ...ready, rooms, venues } });
    expect(items).toEqual([
      { section: "rooms", field: "rows.1.name", message: "Name this room category" },
      { section: "venues", field: "rows.1.name", message: "Name this venue" },
    ]);
  });

  it("asks a refresh request for nothing but row names, since blanks leave the catalogue as it is", () => {
    expect(checkSubmit({ kind: "refresh", sections: {} })).toEqual([]);
    const rooms = state({ rows: [{ rowId: rowId(1), maxOccupancy: 2 }] });
    expect(fieldsOf(checkSubmit({ kind: "refresh", sections: { rooms } }))).toEqual([
      "rooms.rows.0.name",
    ]);
  });

  it("skips a refresh section marked No changes, whatever it still holds", () => {
    const rooms = state({ rows: [{ rowId: rowId(1), maxOccupancy: 2 }] }, true);
    expect(checkSubmit({ kind: "refresh", sections: { rooms } })).toEqual([]);
  });

  it("names a section whose saved answers no longer read, rather than trusting them", () => {
    const property = state({ name: "Synthetic Lake Palace", city: "Udaipur", state: "Atlantis" });
    expect(checkSubmit({ kind: "onboarding", sections: { ...ready, property } })).toEqual([
      { section: "property", field: null, message: "Check this section and save it again" },
    ]);
  });
});

describe("the missing items on the wire", () => {
  it("travel as the envelope's details, one path per item, and read back the same", () => {
    const items = checkSubmit({ kind: "onboarding", sections: {} });
    const details = hotelFormMissingItemDetails(items);
    expect(details[0]).toEqual({ path: "property.name", message: "Enter the hotel's name" });
    const error = new AppError("validation_failed", "Fill in the missing items", details);
    expect(hotelFormMissingItemsOf(error)).toEqual(items);
    const whole = [{ section: "rooms" as const, field: null, message: "Check this section" }];
    expect(
      hotelFormMissingItemsOf({
        code: "validation_failed",
        details: hotelFormMissingItemDetails(whole),
      }),
    ).toEqual(whole);
  });

  it("reads nothing from another error, or a detail that names no section", () => {
    expect(
      hotelFormMissingItemsOf({
        code: "conflict",
        details: [{ path: "property.name", message: "x" }],
      }),
    ).toEqual([]);
    expect(
      hotelFormMissingItemsOf({
        code: "validation_failed",
        details: [{ path: "botToken", message: "x" }],
      }),
    ).toEqual([]);
  });
});

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
      floating: 600,
    };
    expect(isHotelFormSectionComplete("venues", { rows: [venue] }, false)).toBe(true);
    expect(
      isHotelFormSectionComplete("venues", { rows: [{ ...venue, floating: null }] }, false),
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

  it("never counts the fact sheet section incomplete before its uploads, and No changes as complete", () => {
    expect(isHotelFormSectionComplete("fact_sheet_media", {}, false)).toBe(true);
    for (const key of HOTEL_FORM_SECTION_KEYS) {
      expect(isHotelFormSectionComplete(key, {}, true), key).toBe(true);
    }
    expect(isHotelFormSectionComplete("rooms", {}, false)).toBe(false);
  });

  it("counts answers that no longer read as incomplete", () => {
    expect(isHotelFormSectionComplete("food_beverage", { cuisines: "Indian" }, false)).toBe(false);
  });
});
