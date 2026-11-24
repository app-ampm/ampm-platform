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
import { RATE_IMPORT_COLUMNS, RATE_IMPORT_MONEY_COLUMNS } from "./hotel-import-rates.js";
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
    expect(hotelImportKind.options).toEqual(["hotels", "rooms", "venues", "rates"]);
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
        ...template.moneyColumns,
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
    expect(HOTEL_IMPORT_TEMPLATES.rates.capacityColumns).toEqual([]);
  });

  it("reads money cells only in the Rates template (D-184)", () => {
    expect(HOTEL_IMPORT_TEMPLATES.rates.columns).toBe(RATE_IMPORT_COLUMNS);
    expect(HOTEL_IMPORT_TEMPLATES.rates.moneyColumns).toBe(RATE_IMPORT_MONEY_COLUMNS);
    expect(HOTEL_IMPORT_TEMPLATES.rates.requiredColumns).toEqual([
      "hotelSlug",
      "cardName",
      "itemType",
    ]);
    for (const kind of ["hotels", "rooms", "venues"] as const) {
      expect(HOTEL_IMPORT_TEMPLATES[kind].moneyColumns).toEqual([]);
    }
  });
});

describe("hotelImportQuery", () => {
  it("takes no query: every upload is a preview", () => {
    expect(hotelImportQuery.parse({})).toEqual({});
  });

  it("refuses any query, dryRun=true included since Slice 4 (D-184), naming it", () => {
    for (const query of [{ dryRun: "true" }, { dryRun: "false" }, { kind: "rooms" }]) {
      const refused = hotelImportQuery.safeParse(query);
      expect(refused.success).toBe(false);
      const [name] = Object.keys(query);
      expect(refused.success ? "" : refused.error.issues[0]?.message).toContain(`"${name}"`);
    }
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

  describe("a rates row (D-184)", () => {
    const rateRow = {
      line: 3,
      slug: "synthetic-lake-hotel",
      name: "Synthetic season 2027",
      outcome: "create",
      changedFields: ["cardName", "validFrom", "itemType", "roomName", "amount", "unit"],
      item: { itemType: "room_rate", roomName: "Synthetic Lake Suite", venueName: null },
    };
    const rates = { ...result, kind: "rates", rows: [rateRow] };

    it("names its card, and its item by type, room and venue", () => {
      expect(hotelImportResult.safeParse(rates).success).toBe(true);
      const { item: _item, ...withoutItem } = rateRow;
      expect(hotelImportResult.safeParse({ ...rates, rows: [withoutItem] }).success).toBe(true);
    });

    it("names the rates changed fields, and no value", () => {
      const changed = [
        "validTo",
        "amountMax",
        "minQuantity",
        "isIndicative",
        "inclusions",
        "venueName",
      ];
      const row = { ...rateRow, outcome: "update", changedFields: changed };
      expect(hotelImportResult.safeParse({ ...rates, rows: [row] }).success).toBe(true);
      const valued = {
        ...rateRow,
        item: { ...rateRow.item, amount: { minor: 1, currency: "INR" } },
      };
      expect(hotelImportResult.safeParse({ ...rates, rows: [valued] }).success).toBe(false);
    });

    it("refuses an item of an unknown type, or without its room and venue", () => {
      const unknown = { ...rateRow, item: { ...rateRow.item, itemType: "room" } };
      expect(hotelImportResult.safeParse({ ...rates, rows: [unknown] }).success).toBe(false);
      const partial = { ...rateRow, item: { itemType: "room_rate" } };
      expect(hotelImportResult.safeParse({ ...rates, rows: [partial] }).success).toBe(false);
    });
  });
});
