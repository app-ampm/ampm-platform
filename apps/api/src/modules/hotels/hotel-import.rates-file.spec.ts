import {
  HOTEL_IMPORT_TEMPLATES,
  RATE_ITEM_ROOM_OR_VENUE_MESSAGE,
  RUPEES_CELL_MESSAGE,
  RUPEES_RANGE_MESSAGE,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { readImportFile } from "./hotel-import.file.js";
import { buildCandidate, headerProblems } from "./hotel-import.js";
import { RATES_IMPORT } from "./hotel-import.kinds.js";

/*
 * Reading a Rates file (D-184, Slice 4): its fixed headers, its money cells (rupees as a number, read as
 * whole paise, a currency marker or a range refused on its column) and its enum cells, and the item a
 * refused row's cells name, so its report line says which item it was. Synthetic rows only.
 */

const RATES = HOTEL_IMPORT_TEMPLATES.rates;
const file = (...lines: string[]) => new TextEncoder().encode(lines.join("\n"));
const HOTEL = "synthetic-lake-hotel";
const inr = (minor: number) => ({ minor, currency: "INR" });

describe("the Rates template's headers", () => {
  it("hold a file to the Rates columns: the hotel, the card and the item type are required", () => {
    expect(headerProblems(["hotelSlug", "cardName", "itemType", "amount"], RATES)).toEqual([]);
    expect(headerProblems(["hotelSlug", "cardName", "amount"], RATES)).toEqual([
      "Missing column(s): itemType.",
    ]);
    expect(headerProblems(["hotelSlug", "cardName", "itemType", "clientVisible"], RATES)).toEqual([
      "Unknown column(s): clientVisible. Use the template's headers.",
    ]);
  });

  it("refuse a rates file with no rows, naming the kind", () => {
    expect(() => readImportFile(file("hotelSlug,cardName,itemType"), RATES_IMPORT)).toThrow(
      expect.objectContaining({
        details: [{ path: "file", message: "The file has no rate rows." }],
      }),
    );
  });
});

describe("the Rates cells", () => {
  it("read an amount in rupees as whole paise, commas grouping thousands either way", () => {
    const read = buildCandidate(["amount", "amountMax"], ["12,500", "1,25,000.50"], RATES);
    expect(read).toEqual({
      values: { amount: inr(1_250_000), amountMax: inr(12_500_050) },
      problems: [],
    });
  });

  it("refuse a currency marker and a range on their own column, leaving the cell out", () => {
    const read = buildCandidate(["amount", "amountMax"], ["Rs 12,500", "12000-15000"], RATES);
    expect(read).toEqual({
      values: {},
      problems: [
        { field: "amount", message: RUPEES_CELL_MESSAGE },
        { field: "amountMax", message: RUPEES_RANGE_MESSAGE },
      ],
    });
  });

  it("read the item type and the unit as enum cells, and the flag as true or false", () => {
    const read = buildCandidate(
      ["itemType", "unit", "isIndicative", "minQuantity"],
      ["Per plate veg", "per plate", "no", "150"],
      RATES,
    );
    expect(read.values).toEqual({
      itemType: "per_plate_veg",
      unit: "per_plate",
      isIndicative: false,
      minQuantity: 150,
    });
  });

  it("read a whole row, the inclusions and dates as text", () => {
    const read = readImportFile(
      file(
        "hotelSlug,cardName,validFrom,validTo,itemType,roomName,amount,unit,inclusions",
        `${HOTEL},Synthetic 2027,2027-04-01,2028-03-31,Room rate,Synthetic Lake Suite,"12,500",per night,"Breakfast, WiFi"`,
      ),
      RATES_IMPORT,
    );
    expect(read.rows).toEqual([
      {
        line: 2,
        row: {
          hotelSlug: HOTEL,
          cardName: "Synthetic 2027",
          validFrom: "2027-04-01",
          validTo: "2028-03-31",
          itemType: "room_rate",
          roomName: "Synthetic Lake Suite",
          amount: inr(1_250_000),
          unit: "per_night",
          inclusions: "Breakfast, WiFi",
        },
      },
    ]);
  });

  it("report a refused row with its hotel, card and item, when the item type reads", () => {
    const read = readImportFile(
      file(
        "hotelSlug,cardName,itemType,roomName,venueName,amount",
        `${HOTEL},Synthetic 2027,Room rate,Synthetic Lake Suite,,₹12500`,
        `${HOTEL},Synthetic 2027,Venue rental,Synthetic Suite,Synthetic Lawn,5000`,
        `${HOTEL},Synthetic 2027,Room,,,5000`,
      ),
      RATES_IMPORT,
    );
    const item = (itemType: string, roomName: string | null, venueName: string | null) => ({
      itemType,
      roomName,
      venueName,
    });
    expect(read.rejected).toEqual([
      {
        line: 2,
        slug: HOTEL,
        name: "Synthetic 2027",
        item: item("room_rate", "Synthetic Lake Suite", null),
        errors: [{ field: "amount", message: RUPEES_CELL_MESSAGE }],
      },
      {
        line: 3,
        slug: HOTEL,
        name: "Synthetic 2027",
        item: item("venue_rental", "Synthetic Suite", "Synthetic Lawn"),
        errors: [{ field: "venueName", message: RATE_ITEM_ROOM_OR_VENUE_MESSAGE }],
      },
      {
        line: 4,
        slug: HOTEL,
        name: "Synthetic 2027",
        errors: [expect.objectContaining({ field: "itemType" })],
      },
    ]);
  });
});
