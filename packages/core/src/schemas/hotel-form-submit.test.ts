import { describe, expect, it } from "vitest";

import { AppError } from "../errors";
import { hotelFormRevisionAnswersOf } from "./hotel-form-revision";
import {
  checkSubmit,
  hotelFormMissingItemDetails,
  hotelFormMissingItemsOf,
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

  it("skips a row whose only answers are empty or all-null objects, as canonical JSON stores it blank", () => {
    const venues = state({
      rows: [
        { rowId: rowId(1), name: "Lawn", floating: 90 },
        { rowId: rowId(2), seated: { min: null, max: null } },
        { rowId: rowId(3), floating: {} },
      ],
    });
    expect(checkSubmit({ kind: "onboarding", sections: { ...ready, venues } })).toEqual([]);
  });

  it("lists every half-filled pair on any request: a unit without its number, a range or layout missing an end", () => {
    const rooms = state({ rows: [{ rowId: rowId(1), name: "Suite", size: { unit: "sqft" } }] });
    const venues = state({
      totalEventSpace: { unit: "sqm", value: null },
      rows: [
        {
          rowId: rowId(2),
          name: "Lawn",
          area: { unit: "sqm" },
          seated: { min: 250 },
          floating: { max: 600 },
          otherLayouts: [
            { layout: "U-shape", max: 40 },
            { layout: "Classroom", min: 30 },
          ],
          prefunctionArea: { unit: "sqft" },
        },
      ],
    });
    const expected = [
      { section: "rooms", field: "rows.0.size.value", message: "Enter the size" },
      { section: "venues", field: "totalEventSpace.value", message: "Enter the total event space" },
      { section: "venues", field: "rows.0.area.value", message: "Enter the area" },
      { section: "venues", field: "rows.0.seated.max", message: "Give the most guests seated" },
      {
        section: "venues",
        field: "rows.0.floating.min",
        message: "Give the fewest guests floating",
      },
      {
        section: "venues",
        field: "rows.0.otherLayouts.1.max",
        message: "Give the most guests this layout takes",
      },
      {
        section: "venues",
        field: "rows.0.prefunctionArea.value",
        message: "Enter the pre-function area",
      },
    ];
    expect(checkSubmit({ kind: "onboarding", sections: { ...ready, rooms, venues } })).toEqual(
      expected,
    );
    expect(checkSubmit({ kind: "refresh", sections: { rooms, venues } })).toEqual(expected);
    const unnamed = state({ rows: [{ rowId: rowId(3), size: { unit: "sqm" } }] });
    expect(fieldsOf(checkSubmit({ kind: "refresh", sections: { rooms: unnamed } }))).toEqual([
      "rooms.rows.0.name",
      "rooms.rows.0.size.value",
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

  it("names a section the draft answered as unreadable, though the page holds its empty answers", () => {
    const rooms = { answers: {}, noChanges: false, isUnreadable: true };
    expect(checkSubmit({ kind: "onboarding", sections: { ...ready, rooms } })).toEqual([
      { section: "rooms", field: null, message: "Check this section and save it again" },
    ]);
    const marked = { answers: {}, noChanges: true, isUnreadable: true };
    expect(checkSubmit({ kind: "refresh", sections: { rooms: marked } })).toEqual([
      { section: "rooms", field: null, message: "Check this section and save it again" },
    ]);
    const readable = { answers: {}, noChanges: false, isUnreadable: false };
    expect(checkSubmit({ kind: "onboarding", sections: { ...ready, rooms: readable } })).toEqual(
      [],
    );
  });

  it("names a refresh section marked No changes whose saved answers no longer read, as its revision could not hold them", () => {
    const acre = { rowId: rowId(1), name: "Suite", size: { value: 1, unit: "acre" } };
    const rooms = state({ rows: [acre] }, true);
    const sections = { rooms };
    expect(checkSubmit({ kind: "refresh", sections })).toEqual([
      { section: "rooms", field: null, message: "Check this section and save it again" },
    ]);
    const saved = { rooms: { ...rooms, schemaVersion: 1 } };
    expect(() => hotelFormRevisionAnswersOf(saved)).toThrow();
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
