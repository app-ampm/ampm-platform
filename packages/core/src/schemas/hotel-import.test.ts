import { describe, expect, it } from "vitest";

import {
  HOTEL_IMPORT_BOOLEAN_COLUMNS,
  HOTEL_IMPORT_COLUMNS,
  HOTEL_IMPORT_LIST_COLUMNS,
  HOTEL_IMPORT_NUMBER_COLUMNS,
  HOTEL_IMPORT_PREVIEW_TTL_HOURS,
  HOTEL_IMPORT_TEMPLATES,
  hotelImportApplyBody,
  hotelImportApplyParams,
  hotelImportKind,
  hotelImportQuery,
  hotelImportResult,
  hotelImportRow,
} from "./hotel-import.js";
import {
  ROOM_IMPORT_COLUMNS,
  VENUE_IMPORT_CAPACITY_COLUMNS,
  VENUE_IMPORT_COLUMNS,
} from "./hotel-import-rooms-venues.js";

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

describe("HOTEL_IMPORT_TEMPLATES", () => {
  it("has one template per kind, each typed column one of its own", () => {
    expect(Object.keys(HOTEL_IMPORT_TEMPLATES).sort()).toEqual([...hotelImportKind.options].sort());
    for (const template of Object.values(HOTEL_IMPORT_TEMPLATES)) {
      const typed = [
        ...template.requiredColumns,
        ...template.numberColumns,
        ...template.booleanColumns,
        ...template.listColumns,
        ...template.enumColumns,
        ...template.layoutColumns,
        ...template.capacityColumns,
      ];
      for (const column of typed) expect(template.columns).toContain(column);
      for (const column of template.capacityColumns) {
        expect(template.numberColumns).toContain(column);
      }
    }
  });

  it("keeps the hotels template's cells as Slice 2 read them", () => {
    expect(HOTEL_IMPORT_TEMPLATES.hotels.columns).toBe(HOTEL_IMPORT_COLUMNS);
    expect(HOTEL_IMPORT_TEMPLATES.hotels.enumColumns).toEqual([]);
    expect(HOTEL_IMPORT_TEMPLATES.rooms.columns).toBe(ROOM_IMPORT_COLUMNS);
    expect(HOTEL_IMPORT_TEMPLATES.venues.columns).toBe(VENUE_IMPORT_COLUMNS);
  });

  it("refuses a range only in a venue's capacity cells", () => {
    expect(HOTEL_IMPORT_TEMPLATES.hotels.capacityColumns).toEqual([]);
    expect(HOTEL_IMPORT_TEMPLATES.rooms.capacityColumns).toEqual([]);
    expect(HOTEL_IMPORT_TEMPLATES.venues.capacityColumns).toBe(VENUE_IMPORT_CAPACITY_COLUMNS);
  });
});

describe("hotelImportQuery", () => {
  it("takes nothing, or dryRun=true from the previous bundle's Validate", () => {
    expect(hotelImportQuery.parse({})).toEqual({});
    expect(hotelImportQuery.parse({ dryRun: "true" })).toEqual({ dryRun: "true" });
  });

  it("refuses dryRun=false, the previous bundle's import, and anything else", () => {
    const refused = hotelImportQuery.safeParse({ dryRun: "false" });
    expect(refused.success).toBe(false);
    expect(refused.success ? "" : refused.error.issues[0]?.message).toMatch(/validate the file/);
    expect(hotelImportQuery.safeParse({ dryRun: "yes" }).success).toBe(false);
    expect(hotelImportQuery.safeParse({ kind: "rooms" }).success).toBe(false);
  });
});

describe("the apply route", () => {
  it("takes the preview's job id and no body", () => {
    expect(
      hotelImportApplyParams.safeParse({ jobId: "0192f1a0-0000-7000-8000-000000000009" }).success,
    ).toBe(true);
    expect(hotelImportApplyParams.safeParse({ jobId: "latest" }).success).toBe(false);
    expect(hotelImportApplyBody.safeParse(undefined).success).toBe(true);
    expect(hotelImportApplyBody.safeParse({}).success).toBe(true);
    expect(hotelImportApplyBody.safeParse({ rows: [] }).success).toBe(false);
  });

  it("keeps a preview importable for 24 hours", () => {
    expect(HOTEL_IMPORT_PREVIEW_TTL_HOURS).toBe(24);
  });
});

describe("hotelImportResult", () => {
  const result = {
    importJobId: "0192f1a0-0000-7000-8000-000000000009",
    kind: "hotels",
    dryRun: true,
    applied: false,
    totalRows: 1,
    created: 0,
    updated: 1,
    unchanged: 0,
    destinationsCreated: 0,
    mediaRegistered: 0,
    rejected: [],
    rows: [
      {
        line: 2,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Lake Hotel",
        outcome: "update",
        changedFields: ["city"],
      },
    ],
  };

  it("carries its kind, and each row's name and changed fields", () => {
    expect(hotelImportResult.safeParse(result).success).toBe(true);
    const { kind: _kind, ...withoutKind } = result;
    expect(hotelImportResult.safeParse(withoutKind).success).toBe(false);
  });

  it("names the changed columns of any kind, never an unknown one", () => {
    const venueRow = {
      line: 3,
      slug: "synthetic-lake-hotel",
      name: "Synthetic Terrace",
      outcome: "update",
      changedFields: ["setting", "areaSqm", "areaSqft", "otherLayouts"],
    };
    const venues = { ...result, kind: "venues", rows: [venueRow] };
    expect(hotelImportResult.safeParse(venues).success).toBe(true);
    const unknown = { ...venues, rows: [{ ...venueRow, changedFields: ["notAColumn"] }] };
    expect(hotelImportResult.safeParse(unknown).success).toBe(false);
  });

  it("takes a null name for a row with none to show", () => {
    const rows = [{ ...result.rows[0], name: null, outcome: "error", changedFields: [] }];
    expect(hotelImportResult.safeParse({ ...result, rows }).success).toBe(true);
  });
});
