import { describe, expect, it } from "vitest";

import {
  ROOM_IMPORT_BOOLEAN_COLUMNS,
  ROOM_IMPORT_COLUMNS,
  ROOM_IMPORT_ENUM_COLUMNS,
  ROOM_IMPORT_LIST_COLUMNS,
  ROOM_IMPORT_NUMBER_COLUMNS,
  ROOM_IMPORT_REQUIRED_COLUMNS,
  roomImportRow,
  VENUE_IMPORT_BOOLEAN_COLUMNS,
  VENUE_IMPORT_CAPACITY_COLUMNS,
  VENUE_IMPORT_COLUMNS,
  VENUE_IMPORT_ENUM_COLUMNS,
  VENUE_IMPORT_LAYOUT_COLUMNS,
  VENUE_IMPORT_LIST_COLUMNS,
  VENUE_IMPORT_NUMBER_COLUMNS,
  VENUE_IMPORT_REQUIRED_COLUMNS,
  venueImportRow,
} from "./hotel-import-rooms-venues.js";

const HOTEL = { hotelSlug: "synthetic-lake-hotel" };

describe("the Rooms template", () => {
  it("names every row field as a column, and only those", () => {
    expect([...ROOM_IMPORT_COLUMNS].sort()).toEqual(Object.keys(roomImportRow.shape).sort());
  });

  it("classes no column twice and requires the hotel and the name", () => {
    const typed = [
      ...ROOM_IMPORT_NUMBER_COLUMNS,
      ...ROOM_IMPORT_BOOLEAN_COLUMNS,
      ...ROOM_IMPORT_LIST_COLUMNS,
      ...ROOM_IMPORT_ENUM_COLUMNS,
    ];
    expect(new Set(typed).size).toBe(typed.length);
    expect(ROOM_IMPORT_REQUIRED_COLUMNS).toEqual(["hotelSlug", "name"]);
  });

  it("accepts a minimal row and the D-178 fields", () => {
    expect(roomImportRow.safeParse({ ...HOTEL, name: "Synthetic Garden Room" }).success).toBe(true);
    const full = {
      ...HOTEL,
      name: "Synthetic Tent Suite",
      roomCount: 4,
      unitType: "tent_suite",
      viewLabel: "Desert",
      bedConfiguration: "One king bed",
      maxOccupancy: 3,
      sizeSqft: 700,
      facilities: ["Private deck"],
      description: "Synthetic description",
    };
    expect(roomImportRow.safeParse(full).success).toBe(true);
  });

  it("refuses a bad hotel address, an unknown column, an occupancy of 0 and an untyped number", () => {
    const row = { ...HOTEL, name: "Synthetic Room" };
    expect(roomImportRow.safeParse({ ...row, hotelSlug: "Not Kebab" }).success).toBe(false);
    expect(roomImportRow.safeParse({ ...row, slug: "synthetic-room" }).success).toBe(false);
    expect(roomImportRow.safeParse({ ...row, maxOccupancy: 0 }).success).toBe(false);
    expect(roomImportRow.safeParse({ ...row, sizeSqft: "700" }).success).toBe(false);
  });
});

describe("the Venues template", () => {
  it("names every row field as a column, and only those", () => {
    expect([...VENUE_IMPORT_COLUMNS].sort()).toEqual(Object.keys(venueImportRow.shape).sort());
  });

  it("classes no column twice, with the capacities among the numbers", () => {
    const typed = [
      ...VENUE_IMPORT_NUMBER_COLUMNS,
      ...VENUE_IMPORT_BOOLEAN_COLUMNS,
      ...VENUE_IMPORT_LIST_COLUMNS,
      ...VENUE_IMPORT_ENUM_COLUMNS,
      ...VENUE_IMPORT_LAYOUT_COLUMNS,
    ];
    expect(new Set(typed).size).toBe(typed.length);
    expect(VENUE_IMPORT_REQUIRED_COLUMNS).toEqual(["hotelSlug", "name"]);
    for (const column of VENUE_IMPORT_CAPACITY_COLUMNS) {
      expect(VENUE_IMPORT_NUMBER_COLUMNS).toContain(column);
    }
  });

  it("leaves the venue type and the setting to the planner, which needs them only on a create", () => {
    expect(venueImportRow.safeParse({ ...HOTEL, name: "Synthetic Lawn" }).success).toBe(true);
    expect(
      venueImportRow.safeParse({
        ...HOTEL,
        name: "Synthetic Lawn",
        venueType: "garden",
        setting: "outdoor",
      }).success,
    ).toBe(true);
    expect(
      venueImportRow.safeParse({ ...HOTEL, name: "Synthetic Lawn", setting: "open air" }).success,
    ).toBe(false);
  });

  it("takes other layouts as entries, so a stored preview row parses again", () => {
    const row = {
      ...HOTEL,
      name: "Synthetic Ballroom",
      venueType: "ballroom",
      setting: "indoor",
      areaSqft: 9_000,
      lengthM: 40.5,
      otherLayouts: [
        { layout: "Classroom", max: 120 },
        { layout: "U-shape", min: 30, max: 40 },
      ],
      capacityNotes: "Synthetic: 600 to 700 floating",
    };
    const parsed = venueImportRow.parse(row);
    expect(venueImportRow.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    expect(venueImportRow.safeParse({ ...row, otherLayouts: "Classroom: 120" }).success).toBe(
      false,
    );
  });

  it("has no isIndoor column: the API derives it from the setting", () => {
    expect(
      venueImportRow.safeParse({ ...HOTEL, name: "Synthetic Lawn", isIndoor: false }).success,
    ).toBe(false);
  });
});
