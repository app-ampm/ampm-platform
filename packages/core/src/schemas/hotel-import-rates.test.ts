import { describe, expect, it } from "vitest";

import { HOTEL_IMPORT_MAX_RUPEES } from "./hotel-import-cells.js";
import {
  RATE_IMPORT_BOOLEAN_COLUMNS,
  RATE_IMPORT_COLUMNS,
  RATE_IMPORT_ENUM_COLUMNS,
  RATE_IMPORT_LIST_COLUMNS,
  RATE_IMPORT_MONEY_COLUMNS,
  RATE_IMPORT_NUMBER_COLUMNS,
  RATE_IMPORT_REQUIRED_COLUMNS,
  RATE_ITEM_ROOM_OR_VENUE_MESSAGE,
  rateImportRow,
} from "./hotel-import-rates.js";

const ROW = {
  hotelSlug: "synthetic-lake-hotel",
  cardName: "Synthetic season 2027",
  itemType: "room_rate",
};
const inr = (minor: number) => ({ minor, currency: "INR" });

/** The issues a row raises, by field. */
const issuesOf = (row: Record<string, unknown>) => {
  const parsed = rateImportRow.safeParse(row);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
};

describe("the Rates template (D-184, Slice 4)", () => {
  it("names every row field as a column, in template order, and only those", () => {
    expect(RATE_IMPORT_COLUMNS).toEqual([
      "hotelSlug",
      "cardName",
      "validFrom",
      "validTo",
      "itemType",
      "roomName",
      "venueName",
      "amount",
      "amountMax",
      "unit",
      "minQuantity",
      "isIndicative",
      "inclusions",
    ]);
    expect([...RATE_IMPORT_COLUMNS].sort()).toEqual(Object.keys(rateImportRow.shape).sort());
  });

  it("requires the hotel, the card and the item type, and classes no column twice", () => {
    expect(RATE_IMPORT_REQUIRED_COLUMNS).toEqual(["hotelSlug", "cardName", "itemType"]);
    const typed = [
      ...RATE_IMPORT_NUMBER_COLUMNS,
      ...RATE_IMPORT_BOOLEAN_COLUMNS,
      ...RATE_IMPORT_LIST_COLUMNS,
      ...RATE_IMPORT_ENUM_COLUMNS,
      ...RATE_IMPORT_MONEY_COLUMNS,
    ];
    expect(new Set(typed).size).toBe(typed.length);
    expect(RATE_IMPORT_MONEY_COLUMNS).toEqual(["amount", "amountMax"]);
    expect(RATE_IMPORT_ENUM_COLUMNS).toEqual(["itemType", "unit"]);
  });

  it("leaves visibility, the currency and the restricted card fields out of the template", () => {
    for (const column of ["clientVisible", "currency", "source", "internalNotes"]) {
      expect(RATE_IMPORT_COLUMNS).not.toContain(column);
    }
  });
});

describe("rateImportRow", () => {
  it("accepts a row naming only its hotel, card and item type: an update may leave the rest", () => {
    expect(rateImportRow.parse(ROW)).toEqual(ROW);
  });

  it("takes every column already typed, amounts in paise", () => {
    const full = {
      ...ROW,
      validFrom: "2027-04-01",
      validTo: "2028-03-31",
      roomName: "Synthetic Lake Suite",
      amount: inr(1_250_000),
      amountMax: inr(1_500_000),
      unit: "per_night",
      minQuantity: 10,
      isIndicative: false,
      inclusions: "Breakfast for two",
    };
    expect(rateImportRow.parse(full)).toEqual(full);
  });

  it("refuses an unknown column, an unknown item type or unit, and an untyped amount", () => {
    expect(rateImportRow.safeParse({ ...ROW, clientVisible: true }).success).toBe(false);
    expect(rateImportRow.safeParse({ ...ROW, itemType: "room" }).success).toBe(false);
    expect(rateImportRow.safeParse({ ...ROW, unit: "per_day" }).success).toBe(false);
    expect(rateImportRow.safeParse({ ...ROW, amount: "12500" }).success).toBe(false);
  });

  it("holds an amount to whole paise from zero to the import's limit", () => {
    const most = HOTEL_IMPORT_MAX_RUPEES * 100;
    expect(rateImportRow.safeParse({ ...ROW, amount: inr(most) }).success).toBe(true);
    expect(rateImportRow.safeParse({ ...ROW, amount: inr(most + 1) }).success).toBe(false);
    expect(rateImportRow.safeParse({ ...ROW, amount: inr(-1) }).success).toBe(false);
    expect(rateImportRow.safeParse({ ...ROW, amount: inr(12.5) }).success).toBe(false);
  });

  it("holds a card's dates to real calendar days, the last not before the first", () => {
    expect(issuesOf({ ...ROW, validFrom: "2027-02-29" })).toEqual([
      expect.objectContaining({ field: "validFrom" }),
    ]);
    expect(issuesOf({ ...ROW, validFrom: "2027-04-01", validTo: "2027-03-31" })).toEqual([
      { field: "validTo", message: "validTo must not be before validFrom" },
    ]);
    expect(issuesOf({ ...ROW, validFrom: "2027-04-01", validTo: "2027-04-01" })).toEqual([]);
  });

  it("refuses an item for a room and a venue at once", () => {
    expect(
      issuesOf({ ...ROW, roomName: "Synthetic Lake Suite", venueName: "Synthetic Lawn" }),
    ).toEqual([{ field: "venueName", message: RATE_ITEM_ROOM_OR_VENUE_MESSAGE }]);
    expect(RATE_ITEM_ROOM_OR_VENUE_MESSAGE).toBe("An item is for a room or a venue, not both");
  });

  it("bounds the minimum quantity, the names and the inclusions", () => {
    expect(issuesOf({ ...ROW, minQuantity: 100_001 })).toEqual([
      expect.objectContaining({ field: "minQuantity" }),
    ]);
    expect(issuesOf({ ...ROW, minQuantity: 2.5 })).toEqual([
      expect.objectContaining({ field: "minQuantity" }),
    ]);
    expect(issuesOf({ ...ROW, cardName: "x".repeat(256) })).toEqual([
      expect.objectContaining({ field: "cardName" }),
    ]);
    expect(issuesOf({ ...ROW, inclusions: "x".repeat(10_001) })).toEqual([
      expect.objectContaining({ field: "inclusions" }),
    ]);
  });
});
