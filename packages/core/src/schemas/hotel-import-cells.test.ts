import { describe, expect, it } from "vitest";

import {
  HOTEL_IMPORT_MAX_RUPEES,
  hotelImportEnumValue,
  hotelListEntries,
  isNumberRangeCell,
  parseRupeesCell,
  parseVenueLayoutsCell,
  RUPEES_CELL_MESSAGE,
  RUPEES_LIMIT_MESSAGE,
  RUPEES_RANGE_MESSAGE,
} from "./hotel-import-cells.js";
import { hotelRoomUnitType, hotelVenueSetting, venueOtherLayouts } from "./hotel-rooms-venues.js";
import { hotelVenueType } from "./hotels.js";

describe("hotelListEntries", () => {
  it("splits a list at each | and line break, keeping a comma inside an entry", () => {
    expect(hotelListEntries(" Pool | Spa, salon and gym \r\nValet parking\rLawn\n")).toEqual([
      "Pool",
      "Spa, salon and gym",
      "Valet parking",
      "Lawn",
    ]);
  });

  it("drops blank entries, so an empty list is empty", () => {
    expect(hotelListEntries("Pool||\n \n|Spa")).toEqual(["Pool", "Spa"]);
    expect(hotelListEntries(" | \n ")).toEqual([]);
  });
});

describe("hotelImportEnumValue", () => {
  it.each([
    ["Meeting room", hotelVenueType, "meeting_room"],
    ["meeting-room", hotelVenueType, "meeting_room"],
    ["  AMPHITHEATRE ", hotelVenueType, "amphitheatre"],
    ["Tent-suite", hotelRoomUnitType, "tent_suite"],
    ["tent - suite", hotelRoomUnitType, "tent_suite"],
    ["Semi open", hotelVenueSetting, "semi_open"],
    ["semi_open", hotelVenueSetting, "semi_open"],
  ])("reads %s as a value of its enum", (cell, schema, value) => {
    expect(hotelImportEnumValue(cell)).toBe(value);
    expect(schema.safeParse(hotelImportEnumValue(cell)).success).toBe(true);
  });

  it("leaves an unknown value for the schema to refuse", () => {
    expect(hotelVenueType.safeParse(hotelImportEnumValue("Banquet hall")).success).toBe(false);
  });
});

describe("parseVenueLayoutsCell", () => {
  it("reads Name: max and Name: min-max entries", () => {
    expect(parseVenueLayoutsCell("Classroom: 120 | U-shape: 30-40 | Cluster : 80 – 100")).toEqual([
      { layout: "Classroom", max: 120 },
      { layout: "U-shape", min: 30, max: 40 },
      { layout: "Cluster", min: 80, max: 100 },
    ]);
  });

  it("splits a name at its last colon and reads entries on separate lines", () => {
    expect(parseVenueLayoutsCell("Theatre: style A: 90\nBoardroom: 24")).toEqual([
      { layout: "Theatre: style A", max: 90 },
      { layout: "Boardroom", max: 24 },
    ]);
  });

  it("gives no entries for an empty cell", () => {
    expect(parseVenueLayoutsCell(" | ")).toEqual([]);
  });

  it.each([
    ["no colon", "Classroom 120"],
    ["no name", ": 120"],
    ["words for the guests", "Classroom: about 120"],
    ["a thousands comma", "Exhibit: 1,200"],
    ["a decimal", "Classroom: 120.5"],
    ["an open range", "Classroom: 100-"],
    ["one bad entry among good ones", "Classroom: 120 | U-shape"],
  ])("refuses %s", (_case, cell) => {
    expect(parseVenueLayoutsCell(cell)).toBeNull();
  });

  it("leaves the bounds to the row schema", () => {
    const layouts = parseVenueLayoutsCell("U-shape: 40-30");
    expect(layouts).toEqual([{ layout: "U-shape", min: 40, max: 30 }]);
    expect(venueOtherLayouts.safeParse(layouts).success).toBe(false);
  });
});

describe("isNumberRangeCell", () => {
  it.each(["600-700", "600 - 700", "600–700", "1,200-1,500", "600 to 700"])(
    "reads %s as a range",
    (cell) => {
      expect(isNumberRangeCell(cell)).toBe(true);
    },
  );

  it.each(["650", "1,200", "-700", "about 600", "600-700 seated"])(
    "reads %s as no range",
    (cell) => {
      expect(isNumberRangeCell(cell)).toBe(false);
    },
  );
});

describe("parseRupeesCell", () => {
  const paise = (minor: number) => ({ money: { minor, currency: "INR" } });

  it.each([
    ["12500", 1_250_000],
    ["12,500", 1_250_000],
    ["12,500.50", 1_250_050],
    ["12500.5", 1_250_050],
    ["1,25,000", 12_500_000],
    ["12,34,567.89", 123_456_789],
    ["1,234,567", 123_456_700],
    ["0", 0],
    ["  18 ", 1_800],
  ])("reads %s as rupees, in whole paise", (cell, minor) => {
    expect(parseRupeesCell(cell)).toEqual(paise(minor));
  });

  it("takes up to 10,000,000,000 rupees, well inside a rate's column", () => {
    expect(HOTEL_IMPORT_MAX_RUPEES).toBe(10_000_000_000);
    expect(parseRupeesCell("10,000,000,000.00")).toEqual(paise(1_000_000_000_000));
    expect(parseRupeesCell("10000000000.01")).toEqual({ problem: RUPEES_LIMIT_MESSAGE });
    expect(parseRupeesCell("99999999999999999999")).toEqual({ problem: RUPEES_LIMIT_MESSAGE });
  });

  it.each([
    ["a rupee sign", "₹12500"],
    ["Rs", "Rs 12,500"],
    ["Rs.", "Rs. 12500"],
    ["INR", "12500 INR"],
    ["a word", "on request"],
    ["a third decimal", "12500.555"],
    ["a comma out of place", "12,50"],
    ["a space for a comma", "12 500"],
    ["a minus sign", "-500"],
    ["no rupees before the point", ".50"],
  ])("refuses %s, asking for rupees as a number", (_case, cell) => {
    expect(parseRupeesCell(cell)).toEqual({ problem: RUPEES_CELL_MESSAGE });
  });

  it.each(["12000-15000", "12,000 - 15,000", "12000–15000", "12000 to 15000", "Rs 12000-15000"])(
    "refuses the range %s, pointing at amountMax",
    (cell) => {
      expect(parseRupeesCell(cell)).toEqual({ problem: RUPEES_RANGE_MESSAGE });
    },
  );

  it("says what to write, with no currency marker in the words", () => {
    expect(RUPEES_CELL_MESSAGE).toBe(
      "Write the amount in rupees as a number, such as 12500 or 12,500.50",
    );
    expect(RUPEES_RANGE_MESSAGE).toBe("Put a range's upper bound in amountMax");
  });
});
