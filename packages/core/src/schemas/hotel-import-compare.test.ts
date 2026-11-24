import { describe, expect, it } from "vitest";

import { canonicalFieldsJson, fieldChanges } from "../hotel-change-set.js";
import {
  HOTEL_IMPORT_BOOLEAN_COLUMNS,
  HOTEL_IMPORT_COLUMNS,
  HOTEL_IMPORT_LIST_COLUMNS,
  HOTEL_IMPORT_NUMBER_COLUMNS,
} from "./hotel-import.js";
import {
  HOTEL_AREA_PAIRS,
  HOTEL_IMPORT_COMPARED_FIELDS,
  ROOM_AREA_PAIRS,
  ROOM_IMPORT_COMPARED_FIELDS,
  VENUE_AREA_PAIRS,
  VENUE_IMPORT_COMPARED_FIELDS,
} from "./hotel-import-compare.js";
import {
  ROOM_IMPORT_COLUMNS,
  ROOM_IMPORT_ENUM_COLUMNS,
  ROOM_IMPORT_LIST_COLUMNS,
  ROOM_IMPORT_NUMBER_COLUMNS,
  VENUE_IMPORT_COLUMNS,
  VENUE_IMPORT_ENUM_COLUMNS,
  VENUE_IMPORT_LAYOUT_COLUMNS,
  VENUE_IMPORT_LIST_COLUMNS,
  VENUE_IMPORT_NUMBER_COLUMNS,
  type RoomImportRow,
  type VenueImportRow,
} from "./hotel-import-rooms-venues.js";
import type { RoomCategoryView, VenueView } from "./hotels-admin.js";

/** The columns a kind compares: its template's, in template order, less the ones that key a row. */
const comparedColumns = (columns: readonly string[], keys: readonly string[]): string[] =>
  columns.filter((column) => !keys.includes(column));

describe("what each import kind compares", () => {
  it("compares every hotels column but the web address and the references, in template order", () => {
    expect(Object.keys(HOTEL_IMPORT_COMPARED_FIELDS)).toEqual(
      comparedColumns(HOTEL_IMPORT_COLUMNS, ["slug", "destinationName", "imageRef"]),
    );
  });

  it("never compares a room's or venue's name, nor the hotel that keys it", () => {
    expect(Object.keys(ROOM_IMPORT_COMPARED_FIELDS)).toEqual(
      comparedColumns(ROOM_IMPORT_COLUMNS, ["hotelSlug", "name"]),
    );
    expect(Object.keys(VENUE_IMPORT_COMPARED_FIELDS)).toEqual(
      comparedColumns(VENUE_IMPORT_COLUMNS, ["hotelSlug", "name"]),
    );
  });

  it("gives each typed column its kind", () => {
    const kinds: Record<string, string> = {
      ...HOTEL_IMPORT_COMPARED_FIELDS,
      ...ROOM_IMPORT_COMPARED_FIELDS,
      ...VENUE_IMPORT_COMPARED_FIELDS,
    };
    const numbers = [
      ...HOTEL_IMPORT_NUMBER_COLUMNS,
      ...ROOM_IMPORT_NUMBER_COLUMNS,
      ...VENUE_IMPORT_NUMBER_COLUMNS,
    ];
    for (const column of numbers) expect(kinds[column]).toBe("number");
    for (const column of HOTEL_IMPORT_BOOLEAN_COLUMNS) expect(kinds[column]).toBe("boolean");
    const lists = [
      ...HOTEL_IMPORT_LIST_COLUMNS,
      ...ROOM_IMPORT_LIST_COLUMNS,
      ...VENUE_IMPORT_LIST_COLUMNS,
    ];
    for (const column of lists) expect(kinds[column]).toBe("list");
    for (const column of [...ROOM_IMPORT_ENUM_COLUMNS, ...VENUE_IMPORT_ENUM_COLUMNS]) {
      expect(kinds[column]).toBe("enum");
    }
    for (const column of VENUE_IMPORT_LAYOUT_COLUMNS) expect(kinds[column]).toBe("entries");
  });

  it("pairs each area's m² with its sq ft among the compared fields", () => {
    const pairs = [
      [HOTEL_AREA_PAIRS, HOTEL_IMPORT_COMPARED_FIELDS],
      [ROOM_AREA_PAIRS, ROOM_IMPORT_COMPARED_FIELDS],
      [VENUE_AREA_PAIRS, VENUE_IMPORT_COMPARED_FIELDS],
    ] as const;
    for (const [areas, fields] of pairs) {
      for (const { sqm, sqft } of areas) {
        expect(sqft).toBe(sqm.replace(/Sqm$/, "Sqft"));
        expect(Object.keys(fields)).toEqual(expect.arrayContaining([sqm, sqft]));
      }
    }
  });
});

describe("a staff view against an import row", () => {
  const HOTEL = "0192f1a0-0000-7000-8000-000000000001";
  const storedRoom: RoomCategoryView = {
    id: "0192f1a0-0000-7000-8000-000000000021",
    hotelId: HOTEL,
    name: "Synthetic Lake View Suite",
    roomCount: 6,
    maxOccupancy: 3,
    sizeSqm: 60,
    facilities: ["Balcony"],
    description: null,
    unitType: "suite",
    viewLabel: "Lake",
    bedConfiguration: null,
    sizeSqft: 650,
  };
  const storedVenue: VenueView = {
    id: "0192f1a0-0000-7000-8000-000000000022",
    hotelId: HOTEL,
    name: "Synthetic Terrace",
    venueType: "terrace",
    isIndoor: false,
    areaSqm: 279,
    capacityBanquet: 180,
    capacityTheatre: null,
    capacityReception: 300,
    facilities: null,
    description: null,
    setting: "semi_open",
    areaSqft: 3_000,
    lengthM: 30.5,
    widthM: 9.15,
    ceilingHeightM: null,
    prefunctionAreaSqm: null,
    prefunctionAreaSqft: null,
    otherLayouts: [{ layout: "Cluster", max: 120, min: 100 }],
    capacityNotes: null,
  };

  it("compares a rooms row with the stored room, the units rule first", () => {
    const row: RoomImportRow = {
      hotelSlug: "synthetic-lake-hotel",
      name: "synthetic lake view suite",
      sizeSqm: 70,
      viewLabel: "Lake ",
      maxOccupancy: 4,
    };
    expect(
      fieldChanges(storedRoom, row, ROOM_IMPORT_COMPARED_FIELDS, { areas: ROOM_AREA_PAIRS }),
    ).toEqual(["maxOccupancy", "sizeSqm", "sizeSqft"]);
  });

  it("compares a venues row with the stored venue, layouts and decimals included", () => {
    const row: VenueImportRow = {
      hotelSlug: "synthetic-lake-hotel",
      name: "Synthetic Terrace",
      setting: "semi_open",
      areaSqft: 3_000,
      widthM: 9.15,
      otherLayouts: [{ layout: "Cluster", min: 100, max: 120 }],
      capacityBanquet: 200,
    };
    const options = { areas: VENUE_AREA_PAIRS };
    expect(fieldChanges(storedVenue, row, VENUE_IMPORT_COMPARED_FIELDS, options)).toEqual([
      "capacityBanquet",
    ]);
  });

  it("hashes the same stored values to the same token text", () => {
    const again = { ...storedVenue, otherLayouts: [{ min: 100, max: 120, layout: "Cluster " }] };
    expect(canonicalFieldsJson(again, VENUE_IMPORT_COMPARED_FIELDS)).toBe(
      canonicalFieldsJson(storedVenue, VENUE_IMPORT_COMPARED_FIELDS),
    );
  });
});
