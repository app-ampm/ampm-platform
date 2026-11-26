import {
  HOTEL_FORM_PIN_REFUSAL,
  HOTEL_FORM_SECTION_DRAFTS,
  canonicalJson,
  type HotelFormSectionAnswers,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { BOOKING_TERMS_MODEL, bookingId } from "./booking-terms.form";
import { CONTACT_MODEL, contactId, sameAsMe } from "./contact.form";
import { FACT_SHEET_MODEL } from "./fact-sheet.form";
import { capacityInput, numberInput } from "./field-values";
import { foodBeverageModel } from "./food-beverage.form";
import { PROPERTY_MODEL, propertyId } from "./property.form";
import { ROOMS_MODEL, emptyRoom, roomsId } from "./rooms.form";
import { VENUE_FIELDS_COPY } from "./section-fields-copy";
import { VENUES_MODEL, venuesId } from "./venues.form";

/* Each section's fields as the page holds them, and their reading into the draft (D-190 §2 and §5). */

const ROW_A = "0192f3a0-7d3e-4b1a-9c2f-000000000001";
const ROW_B = "0192f3a0-7d3e-4b1a-9c2f-000000000002";

/** Keys the page would make (UUIDs), numbered so a test can name them. */
function keys() {
  let next = 0;
  return () => `0192f3a0-7d3e-4b1a-9c2f-${String((next += 1) + 100).padStart(12, "0")}`;
}

const PROPERTY: HotelFormSectionAnswers["property"] = {
  name: "Synthetic Lake Palace",
  isChain: true,
  groupName: "Synthetic Hotels",
  city: "Udaipur",
  state: "Rajasthan",
  postalCode: "313001",
  airport: { name: "Synthetic Airport", km: 24.5, minutes: 40 },
  facilities: ["Spa", "Other"],
  facilitiesOther: "Boat jetty",
};

describe("property and location", () => {
  it("reads saved answers back unchanged, so opening a section never makes a save", () => {
    const fields = PROPERTY_MODEL.fieldsOf(PROPERTY, keys());
    expect(fields.airport).toEqual({ name: "Synthetic Airport", km: "24.5", minutes: "40" });
    const { answers, errors } = PROPERTY_MODEL.answersOf(fields, PROPERTY);
    expect(errors).toEqual({});
    expect(canonicalJson(answers)).toBe(canonicalJson(PROPERTY));
  });

  it("keeps a refused field as saved, with its message on that field only", () => {
    const fields = {
      ...PROPERTY_MODEL.fieldsOf(PROPERTY, keys()),
      postalCode: "01234",
      city: "Jaipur",
    };
    const { answers, errors } = PROPERTY_MODEL.answersOf(fields, PROPERTY);
    expect(errors).toEqual({ [propertyId("postalCode")]: HOTEL_FORM_PIN_REFUSAL });
    expect(answers.postalCode).toBe("313001");
    expect(answers.city).toBe("Jaipur");
  });

  it("reads a distance as typed, and refuses words in a number without making it NaN", () => {
    const base = PROPERTY_MODEL.fieldsOf({}, keys());
    const fields = { ...base, airport: { name: "", km: "24.5", minutes: "about 40" } };
    const { answers, errors } = PROPERTY_MODEL.answersOf(fields, {});
    expect(answers.airport).toEqual({ name: null, km: 24.5, minutes: undefined });
    expect(Object.keys(errors)).toEqual([propertyId("airport", "minutes")]);
    expect(() => canonicalJson(answers)).not.toThrow();
    expect(numberInput("1,20,000")).toBe(120000);
    expect(numberInput("12a")).toBe("12a");
    expect(numberInput("  ")).toBeNull();
  });

  it("leaves a chain's name and Other's words out once they no longer apply, keeping them on the page", () => {
    const fields = {
      ...PROPERTY_MODEL.fieldsOf(PROPERTY, keys()),
      isChain: "no" as const,
      facilities: ["Spa"],
    };
    const { answers } = PROPERTY_MODEL.answersOf(fields, PROPERTY);
    expect(answers.isChain).toBe(false);
    expect(answers.groupName).toBeNull();
    expect(answers.facilitiesOther).toBeNull();
    expect(fields.groupName).toBe("Synthetic Hotels");
  });
});

describe("contacts", () => {
  it("starts with one blank contact, and fills Same as me from the person and this tab's mobile", () => {
    const fields = CONTACT_MODEL.fieldsOf({}, keys());
    expect(fields.contacts).toHaveLength(1);
    const person = { fullName: "Asha Rao", designation: "General Manager" };
    const filled = sameAsMe(fields.contacts[0]!, person, "98765 43210");
    expect(filled).toMatchObject({
      name: "Asha Rao",
      role: "General Manager",
      phone: "98765 43210",
    });
    const { answers } = CONTACT_MODEL.answersOf({ ...fields, contacts: [filled] }, {});
    expect(answers.contacts?.[0]?.phone).toBe("+919876543210");
    // Without the mobile (a reload), a phone typed already stays.
    expect(sameAsMe({ ...filled, phone: "0141 234 5678" }, person, "").phone).toBe("0141 234 5678");
  });

  it("sends a refused field blank rather than another contact's saved value", () => {
    const saved = {
      contacts: [{ name: "First", email: "first@hotel.example" }, { name: "Second" }],
    };
    const fields = CONTACT_MODEL.fieldsOf(saved, keys());
    const [, second] = fields.contacts;
    const edited = { ...fields, contacts: [{ ...second!, email: "not-an-email" }] };
    const { answers, errors } = CONTACT_MODEL.answersOf(edited, saved);
    expect(answers.contacts).toEqual([{ name: "Second", role: null, phone: null, email: null }]);
    expect(errors[contactId(second!.key, "email")]).toMatch(/email address/);
  });
});

describe("rooms", () => {
  const SAVED: HotelFormSectionAnswers["rooms"] = {
    totalRooms: 40,
    rows: [
      { rowId: ROW_A, name: "Deluxe", roomCount: 30, size: { value: 450, unit: "sqft" } },
      { rowId: ROW_B, name: "Suite", roomCount: 10, size: { value: 60, unit: "sqm" } },
    ],
  };

  it("keys each row by its id, so a refused field keeps that row's saved value after a removal", () => {
    const fields = ROOMS_MODEL.fieldsOf(SAVED, keys());
    const suite = { ...fields.rows[1]!, sizeValue: "sixty" };
    const { answers, errors } = ROOMS_MODEL.answersOf({ ...fields, rows: [suite] }, SAVED);
    expect(answers.rows).toEqual([
      expect.objectContaining({ rowId: ROW_B, size: { value: 60, unit: "sqm" } }),
    ]);
    expect(errors[roomsId(ROW_B, "size")]).toBe("Enter the area");
  });

  it("starts with one blank row under a new id, and adds rows the same way", () => {
    const fields = ROOMS_MODEL.fieldsOf({}, keys());
    expect(fields.rows).toHaveLength(1);
    expect(
      HOTEL_FORM_SECTION_DRAFTS.rooms.safeParse({ rows: [{ rowId: fields.rows[0]!.rowId }] })
        .success,
    ).toBe(true);
    expect(emptyRoom(ROW_A).sizeUnit).toBe("sqft");
  });
});

describe("venues", () => {
  it("reads a capacity as a number or a range, and the other layouts the same way", () => {
    expect(capacityInput("250")).toBe(250);
    expect(capacityInput("250–300")).toEqual({ min: 250, max: 300 });
    expect(capacityInput("250 to 300")).toEqual({ min: 250, max: 300 });
    const fields = VENUES_MODEL.fieldsOf({}, keys());
    const venue = {
      ...fields.rows[0]!,
      name: "Lake Lawn",
      seated: "250-300",
      layouts: [
        { key: "l1", layout: "Classroom", guests: "120" },
        { key: "l2", layout: "U-shape", guests: "30–40" },
        { key: "l3", layout: "", guests: "" },
      ],
    };
    const { answers, errors } = VENUES_MODEL.answersOf({ ...fields, rows: [venue] }, {});
    expect(errors).toEqual({});
    expect(answers.rows?.[0]?.seated).toEqual({ min: 250, max: 300 });
    expect(answers.rows?.[0]?.otherLayouts).toEqual([
      { layout: "Classroom", max: 120 },
      { layout: "U-shape", min: 30, max: 40 },
    ]);
  });

  it("keeps the saved layouts while one cannot be read, saying why on its field", () => {
    const saved: HotelFormSectionAnswers["venues"] = {
      rows: [{ rowId: ROW_A, name: "Hall", otherLayouts: [{ layout: "Boardroom", max: 20 }] }],
    };
    const fields = VENUES_MODEL.fieldsOf(saved, keys());
    const hall = { ...fields.rows[0]!, layouts: [{ key: "l9", layout: "Cluster", guests: "" }] };
    const { answers, errors } = VENUES_MODEL.answersOf({ ...fields, rows: [hall] }, saved);
    expect(answers.rows?.[0]?.otherLayouts).toEqual([{ layout: "Boardroom", max: 20 }]);
    expect(errors[venuesId(ROW_A, "layouts", "l9", "guests")]).toBe(
      VENUE_FIELDS_COPY.layoutGuestsMissing,
    );
  });
});

describe("booking terms, food and beverage, the fact sheet", () => {
  it("asks the fewest rooms without a buyout only while a buyout is not always needed", () => {
    const fields = {
      ...BOOKING_TERMS_MODEL.fieldsOf({}, keys()),
      buyout: "required",
      minRooms: "20",
    };
    expect(BOOKING_TERMS_MODEL.answersOf(fields, {}).answers.minRoomsWithoutBuyout).toBeNull();
    const depends = BOOKING_TERMS_MODEL.answersOf({ ...fields, buyout: "depends" }, {});
    expect(depends.answers).toMatchObject({
      weddingBuyoutPolicy: "depends",
      minRoomsWithoutBuyout: 20,
    });
    const wrong = BOOKING_TERMS_MODEL.answersOf({ ...fields, minNights: "0" }, { minNights: 2 });
    expect(wrong.answers.minNights).toBe(2);
    expect(wrong.errors[bookingId("minNights")]).toBe("Use 1 or more");
  });

  it("keeps Other's cuisine words only while Other is chosen, and Yes or No can be unanswered", () => {
    const model = foodBeverageModel("Other");
    const fields = {
      ...model.fieldsOf({}, keys()),
      cuisines: ["Indian", "Other"],
      cuisinesOther: "Rajasthani thali",
      servesAlcohol: "no" as const,
    };
    expect(model.answersOf(fields, {}).answers).toMatchObject({
      cuisines: ["Indian", "Other"],
      cuisinesOther: "Rajasthani thali",
      servesAlcohol: false,
      isPureVegetarian: null,
    });
    expect(
      model.answersOf({ ...fields, cuisines: ["Indian"] }, {}).answers.cuisinesOther,
    ).toBeNull();
  });

  it("takes the fact sheet's month as the browser's month field gives it", () => {
    const fields = { ...FACT_SHEET_MODEL.fieldsOf({}, keys()), factSheetAsOf: "2026-09" };
    expect(FACT_SHEET_MODEL.answersOf(fields, {}).answers.factSheetAsOf).toBe("2026-09");
    const typed = FACT_SHEET_MODEL.answersOf({ ...fields, factSheetAsOf: "Sept 2026" }, {});
    expect(typed.answers.factSheetAsOf).toBeUndefined();
    expect(Object.values(typed.errors)).toEqual(["Give the month, such as 2026-09"]);
  });
});
