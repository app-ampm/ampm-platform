import { describe, expect, it } from "vitest";

import {
  HOTEL_IMPORT_BOOLEAN_COLUMNS,
  HOTEL_IMPORT_COLUMNS,
  HOTEL_IMPORT_LIST_COLUMNS,
  HOTEL_IMPORT_NUMBER_COLUMNS,
  hotelImportQuery,
  hotelImportResult,
  hotelImportRow,
  hotelListEntries,
} from "./hotel-import.js";

describe("hotelImportRow", () => {
  const row = { destinationSlug: "udaipur", name: "Synthetic Lake Hotel" };

  it("accepts a minimal row (destination slug and name)", () => {
    expect(hotelImportRow.parse(row)).toMatchObject(row);
  });

  it("takes the D-178 fields and the showcase flag", () => {
    const parsed = hotelImportRow.safeParse({
      ...row,
      publicShowcase: true,
      city: "Udaipur",
      airportDistanceKm: 22.5,
      cuisines: ["Indian"],
      weddingBuyoutPolicy: "required",
    });
    expect(parsed.success).toBe(true);
  });

  it("validates already-typed values: a string where a number belongs is refused", () => {
    expect(hotelImportRow.safeParse({ ...row, totalRooms: "many" }).success).toBe(false);
    expect(hotelImportRow.safeParse({ ...row, totalRooms: 84 }).success).toBe(true);
  });

  it("refuses an unknown column and a bad destination slug", () => {
    expect(hotelImportRow.safeParse({ ...row, mystery: "x" }).success).toBe(false);
    expect(hotelImportRow.safeParse({ destinationSlug: "Not Kebab", name: "x" }).success).toBe(
      false,
    );
  });
});

describe("the hotels template", () => {
  it("names every row field as a column, and only those", () => {
    expect([...HOTEL_IMPORT_COLUMNS].sort()).toEqual(Object.keys(hotelImportRow.shape).sort());
  });

  it("classes no column twice", () => {
    const typed = [
      ...HOTEL_IMPORT_NUMBER_COLUMNS,
      ...HOTEL_IMPORT_BOOLEAN_COLUMNS,
      ...HOTEL_IMPORT_LIST_COLUMNS,
    ];
    expect(new Set(typed).size).toBe(typed.length);
  });
});

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

describe("hotelImportQuery", () => {
  it("reads dryRun as a boolean, false by default", () => {
    expect(hotelImportQuery.parse({ dryRun: "true" }).dryRun).toBe(true);
    expect(hotelImportQuery.parse({}).dryRun).toBe(false);
    expect(hotelImportQuery.safeParse({ dryRun: "yes" }).success).toBe(false);
  });
});

describe("hotelImportResult", () => {
  it("carries the unchanged count and a report per row", () => {
    const result = {
      importJobId: "0192f1a0-0000-7000-8000-000000000009",
      dryRun: true,
      applied: false,
      totalRows: 1,
      created: 0,
      updated: 1,
      unchanged: 0,
      destinationsCreated: 0,
      mediaRegistered: 0,
      rejected: [],
      rows: [{ line: 2, slug: "synthetic-lake-hotel", outcome: "update", changedFields: ["city"] }],
    };
    expect(hotelImportResult.safeParse(result).success).toBe(true);
    expect(
      hotelImportResult.safeParse({
        ...result,
        rows: [{ ...result.rows[0], changedFields: ["notAColumn"] }],
      }).success,
    ).toBe(false);
  });
});
