import { describe, expect, it } from "vitest";

import { INDIAN_STATES } from "./indian-states";
import { HOTEL_FACILITY_OPTIONS } from "./hotel-form-options";
import {
  HOTEL_FORM_CONTACTS_MAX,
  HOTEL_FORM_ROOM_ROWS_MAX,
  HOTEL_FORM_SCHEMA_VERSIONS,
  HOTEL_FORM_SECTION_KEYS,
  HOTEL_FORM_VENUE_ROWS_MAX,
  hotelFormSectionKey,
} from "./hotel-form-section-keys";
import {
  HOTEL_FORM_SECTION_DRAFTS,
  hotelFormBookingTermsDraft,
  hotelFormContactDraft,
  hotelFormFactSheetMediaDraft,
  hotelFormFoodBeverageDraft,
  hotelFormPropertyDraft,
  hotelFormRoomsDraft,
  hotelFormVenuesDraft,
} from "./hotel-form-sections";

/*
 * The hotel form's seven section drafts (D-190 §2; plan §5.1): strict objects, every field optional and
 * nullable, the catalogue's bounds and the form's field rules, the row caps, and a byte cap on each
 * section's canonical JSON. Synthetic data only: made-up names, example domains, reserved test numbers.
 */

const rowId = (n: number): string => `0192f1a0-0000-4000-8000-${String(n).padStart(12, "0")}`;

const property = {
  name: "Synthetic Lake Palace",
  isChain: true,
  groupName: "Synthetic Heritage Group",
  street: "1 Lake Road",
  locality: "Old City",
  city: "Udaipur",
  state: "Rajasthan",
  postalCode: "313 001",
  mapsUrl: "https://maps.app.goo.gl/AbC123xyz",
  website: "www.synthetic-lake-palace.example",
  airport: { name: "Synthetic Airport", km: 22.5, minutes: 40 },
  railwayStation: { name: "Synthetic Junction", km: 4, minutes: 15 },
  cityCentre: { name: "Clock Tower", km: 1.5, minutes: 10 },
  accessNotes: "Off the lake road, past the ghats.",
  starCategory: "5 star deluxe",
  description: "A lakeside palace with courtyards and lawns.",
  facilities: ["Swimming pool", "Spa", "Other"],
  facilitiesOther: "Boat jetty",
  noLongerOffered: "The rooftop bar closed in 2026.",
};

const venue = {
  rowId: rowId(1),
  name: "Synthetic Courtyard",
  setting: "outdoor",
  venueType: "courtyard",
  area: { value: 12_000, unit: "sqft" },
  seated: { min: 250, max: 300 },
  floating: 600,
  theatre: 400,
  otherLayouts: [{ layout: "U-shape", max: 40, min: 30 }],
  lengthM: 40.25,
  widthM: 30,
  ceilingHeightM: 0,
  prefunctionArea: { value: 150, unit: "sqm" },
  notes: "Covered in the monsoon.",
};

describe("the seven sections", () => {
  it("are keyed as D-190 names them, in the form's order", () => {
    expect(HOTEL_FORM_SECTION_KEYS).toEqual([
      "property",
      "contact",
      "rooms",
      "venues",
      "booking_terms",
      "food_beverage",
      "fact_sheet_media",
    ]);
    expect(hotelFormSectionKey.options).toEqual([...HOTEL_FORM_SECTION_KEYS]);
    expect(Object.keys(HOTEL_FORM_SECTION_DRAFTS)).toEqual([...HOTEL_FORM_SECTION_KEYS]);
    expect(Object.values(HOTEL_FORM_SCHEMA_VERSIONS)).toEqual(Array(7).fill(1));
  });

  it("each take nothing answered, the refresh note, and no key they do not know", () => {
    for (const key of HOTEL_FORM_SECTION_KEYS) {
      const draft = HOTEL_FORM_SECTION_DRAFTS[key];
      expect(draft.parse({}), key).toEqual({});
      expect(draft.parse({ noLongerOffered: "  " }), key).toEqual({ noLongerOffered: null });
      expect(draft.safeParse({ notAField: 1 }).success, key).toBe(false);
    }
  });

  it("each refuse a __proto__ member, as JSON.parse makes it, at the top and inside a row", () => {
    for (const key of HOTEL_FORM_SECTION_KEYS) {
      const answers: unknown = JSON.parse('{"__proto__":{"name":"x"}}');
      expect(HOTEL_FORM_SECTION_DRAFTS[key].safeParse(answers).success, key).toBe(false);
    }
    const room: unknown = JSON.parse(`{"rows":[{"rowId":"${rowId(1)}","__proto__":{"a":1}}]}`);
    expect(hotelFormRoomsDraft.safeParse(room).success).toBe(false);
  });
});

describe("property", () => {
  it("takes the hotel's details, a PIN without spaces and the website over https", () => {
    const parsed = hotelFormPropertyDraft.parse(property);
    expect(parsed).toMatchObject({
      postalCode: "313001",
      website: "https://www.synthetic-lake-palace.example/",
      airport: { name: "Synthetic Airport", km: 22.5, minutes: 40 },
    });
  });

  it("takes the state from the list, facility chips with Other, and 600 characters of description", () => {
    expect(
      INDIAN_STATES.every((state) => hotelFormPropertyDraft.safeParse({ state }).success),
    ).toBe(true);
    expect(hotelFormPropertyDraft.safeParse({ state: "Rajputana" }).success).toBe(false);
    expect(
      hotelFormPropertyDraft.safeParse({ facilities: [...HOTEL_FACILITY_OPTIONS] }).success,
    ).toBe(true);
    expect(hotelFormPropertyDraft.safeParse({ facilities: ["Spa", "Spa"] }).success).toBe(false);
    expect(hotelFormPropertyDraft.safeParse({ facilities: ["Helipad"] }).success).toBe(false);
    expect(hotelFormPropertyDraft.safeParse({ description: "x".repeat(600) }).success).toBe(true);
    expect(hotelFormPropertyDraft.safeParse({ description: "x".repeat(601) }).success).toBe(false);
  });

  it("refuses an access point it does not know the fields of, and a field its rule refuses", () => {
    expect(hotelFormPropertyDraft.safeParse({ airport: { code: "UDR" } }).success).toBe(false);
    const issues = hotelFormPropertyDraft.safeParse({
      mapsUrl: "https://example.com/map",
      website: "http://synthetic-lake-palace.example",
      postalCode: "013001",
    }).error?.issues;
    expect(issues?.map((issue) => issue.path.join("."))).toEqual([
      "postalCode",
      "mapsUrl",
      "website",
    ]);
  });
});

describe("contact", () => {
  it("takes up to 3 contacts, phones in E.164 and emails lower-case", () => {
    const contacts = [
      {
        name: "Synthetic Sales",
        role: "Sales Manager",
        phone: "070000 01234",
        email: "S@Hotel.Example",
      },
      { name: "Synthetic Events", email: "events@hotel.example" },
      {},
    ];
    expect(hotelFormContactDraft.parse({ contacts }).contacts?.[0]).toEqual({
      name: "Synthetic Sales",
      role: "Sales Manager",
      phone: "+917000001234",
      email: "s@hotel.example",
    });
    const four = [...contacts, { name: "One too many" }];
    expect(four).toHaveLength(HOTEL_FORM_CONTACTS_MAX + 1);
    expect(hotelFormContactDraft.safeParse({ contacts: four }).error?.issues[0]?.message).toBe(
      "At most 3 contacts",
    );
    expect(hotelFormContactDraft.safeParse({ contacts: [{ mobile: "1" }] }).success).toBe(false);
  });
});

describe("rooms", () => {
  it("takes the total and rows with their size and unit, keyed by a row id each", () => {
    const rows = [
      {
        rowId: rowId(1),
        name: "Lake Suite",
        roomCount: 4,
        unitType: "suite",
        size: { value: 650, unit: "sqft" },
        maxOccupancy: 3,
        viewLabel: "Lake",
        bedConfiguration: "1 king",
        notes: "Balcony",
      },
      { rowId: rowId(2) },
    ];
    expect(hotelFormRoomsDraft.parse({ totalRooms: 40, rows }).rows).toHaveLength(2);
    expect(hotelFormRoomsDraft.safeParse({ rows: [{ name: "No id" }] }).success).toBe(false);
    expect(
      hotelFormRoomsDraft.safeParse({ rows: [rows[1], rows[1]] }).error?.issues[0]?.message,
    ).toBe("Give each row its own id");
    expect(
      hotelFormRoomsDraft.safeParse({ rows: [{ rowId: rowId(3), maxOccupancy: 0 }] }).success,
    ).toBe(false);
  });

  it("keeps a row id lower-case, so two ids differing only in case are one row's", () => {
    const upper = rowId(7).toUpperCase();
    expect(hotelFormRoomsDraft.parse({ rows: [{ rowId: upper }] }).rows?.[0]?.rowId).toBe(rowId(7));
    expect(
      hotelFormRoomsDraft.safeParse({ rows: [{ rowId: rowId(7) }, { rowId: upper }] }).error
        ?.issues[0]?.message,
    ).toBe("Give each row its own id");
    expect(
      hotelFormVenuesDraft.safeParse({ rows: [{ rowId: upper }, { rowId: rowId(7) }] }).error
        ?.issues[0]?.message,
    ).toBe("Give each row its own id");
  });

  it("stops at 60 rows", () => {
    const rows = Array.from({ length: HOTEL_FORM_ROOM_ROWS_MAX + 1 }, (_, n) => ({
      rowId: rowId(n),
    }));
    expect(hotelFormRoomsDraft.safeParse({ rows: rows.slice(0, -1) }).success).toBe(true);
    expect(hotelFormRoomsDraft.safeParse({ rows }).error?.issues[0]?.message).toBe(
      "At most 60 room rows",
    );
  });
});

describe("venues", () => {
  it("takes a venue's setting, type, area, capacities, layouts, dimensions and pre-function area", () => {
    const parsed = hotelFormVenuesDraft.parse({
      totalEventSpace: { value: 40_000, unit: "sqft" },
      rows: [venue],
    });
    expect(parsed.rows?.[0]).toEqual(venue);
  });

  it("refuses a capacity range backwards, a 13th layout, three decimals of a metre and a 41st row", () => {
    const one = (patch: object) =>
      hotelFormVenuesDraft.safeParse({ rows: [{ ...venue, ...patch }] });
    expect(one({ seated: { min: 300, max: 250 } }).error?.issues[0]?.path).toEqual([
      "rows",
      0,
      "seated",
      "min",
    ]);
    const layouts = Array.from({ length: 13 }, (_, n) => ({ layout: `Layout ${n}`, max: 10 }));
    expect(one({ otherLayouts: layouts }).success).toBe(false);
    expect(one({ lengthM: 12.345 }).success).toBe(false);
    expect(one({ venueType: "stadium" }).success).toBe(false);
    const rows = Array.from({ length: HOTEL_FORM_VENUE_ROWS_MAX + 1 }, (_, n) => ({
      rowId: rowId(n),
    }));
    expect(hotelFormVenuesDraft.safeParse({ rows }).error?.issues[0]?.message).toBe(
      "At most 40 venue rows",
    );
  });
});

describe("booking terms, food and beverage, and the fact sheet", () => {
  it("take the catalogue's booking terms", () => {
    const terms = {
      weddingBuyoutPolicy: "depends",
      minRoomsWithoutBuyout: 30,
      minNights: 2,
      parallelFunctions: "allowed",
      notes: "Two lawns run apart.",
    };
    expect(hotelFormBookingTermsDraft.parse(terms)).toEqual(terms);
    expect(hotelFormBookingTermsDraft.safeParse({ minNights: 0 }).success).toBe(false);
    expect(hotelFormBookingTermsDraft.safeParse({ weddingBuyoutPolicy: "maybe" }).success).toBe(
      false,
    );
  });

  it("take cuisines once each ignoring case, the Other text and the three Yes or No facts", () => {
    const food = {
      cuisines: ["Indian", "Other"],
      cuisinesOther: "Goan",
      isPureVegetarian: false,
      hasSeparateVegKitchen: true,
      servesAlcohol: null,
    };
    expect(hotelFormFoodBeverageDraft.parse(food)).toEqual(food);
    expect(hotelFormFoodBeverageDraft.safeParse({ cuisines: ["Indian", "indian"] }).success).toBe(
      false,
    );
    expect(hotelFormFoodBeverageDraft.safeParse({ cuisines: ["Goan\u0000"] }).success).toBe(false);
  });

  it("asks only when the fact sheet was last updated, as a month", () => {
    expect(hotelFormFactSheetMediaDraft.parse({ factSheetAsOf: "2026-03" })).toEqual({
      factSheetAsOf: "2026-03",
    });
    expect(hotelFormFactSheetMediaDraft.safeParse({ factSheetAsOf: "March" }).success).toBe(false);
  });
});
