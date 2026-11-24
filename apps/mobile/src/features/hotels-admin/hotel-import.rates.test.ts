import {
  hotelImportEnumValue,
  hotelRateItemUnit,
  RATE_ITEM_TYPES,
  type HotelImportRowItem,
  type HotelImportRowReport,
} from "@ampm/core";

import { rowOutcomeText } from "./hotel-import.format";
import { rateItemTypeCell, rateRowNames, rateUnitCell } from "./hotel-import.rates";

const SUITE: HotelImportRowItem = {
  itemType: "room_rate",
  roomName: "Lake View Suite",
  venueName: null,
};

/** A rates row of the report, for an item (or none, when its type did not read). */
function rateRow(
  item: HotelImportRowItem | null,
  overrides: Partial<Omit<HotelImportRowReport, "item">> = {},
): HotelImportRowReport {
  const row: HotelImportRowReport = {
    line: 3,
    slug: "synthetic-lake-hotel",
    name: "2026-27",
    outcome: "create",
    changedFields: ["amount", "unit"],
    ...overrides,
  };
  return item === null ? row : { ...row, item };
}

describe("a rates row on screen", () => {
  it("names its card, its item type as the rates screens label it, and its room", () => {
    expect(rowOutcomeText(rateRow(SUITE), "rates")).toBe(
      "Line 3 · synthetic-lake-hotel · 2026-27 · Room rate · Lake View Suite · New item: amount, unit",
    );
  });

  it("names a venue's item the same way, in the label the staff rate sheet shows", () => {
    const lawn: HotelImportRowItem = {
      itemType: "per_plate_veg",
      roomName: null,
      venueName: "Synthetic Lawn",
    };
    const row = rateRow(lawn, { outcome: "update", changedFields: ["amountMax"] });
    expect(rowOutcomeText(row, "rates")).toBe(
      "Line 3 · synthetic-lake-hotel · 2026-27 · Per plate (veg) · Synthetic Lawn · Update: amountMax",
    );
  });

  it("names no room or venue for an item of the whole card, and no item when its type did not read", () => {
    const tax: HotelImportRowItem = { itemType: "tax", roomName: null, venueName: null };
    expect(rateRowNames(rateRow(tax))).toEqual(["2026-27", "Tax"]);
    expect(rateRowNames(rateRow(null))).toEqual(["2026-27"]);
    expect(rateRowNames(rateRow(SUITE, { name: null }))).toEqual(["Room rate", "Lake View Suite"]);
  });
});

describe("a rates cell", () => {
  it("spells each item type as its staff label without the brackets, which the reader reads back", () => {
    expect(rateItemTypeCell("room_rate")).toBe("Room rate");
    expect(rateItemTypeCell("per_plate_veg")).toBe("Per plate veg");
    expect(rateItemTypeCell("per_plate_non_veg")).toBe("Per plate non-veg");
    for (const type of RATE_ITEM_TYPES) {
      expect(hotelImportEnumValue(rateItemTypeCell(type))).toBe(type);
    }
  });

  it("spells each unit with spaces, percent among them, which the reader reads back", () => {
    expect(rateUnitCell("per_night")).toBe("per night");
    expect(rateUnitCell("percent")).toBe("percent");
    for (const unit of hotelRateItemUnit.options) {
      expect(hotelImportEnumValue(rateUnitCell(unit))).toBe(unit);
    }
  });
});
