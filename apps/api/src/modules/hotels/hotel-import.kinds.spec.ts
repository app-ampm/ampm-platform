import {
  HOTEL_IMPORT_TEMPLATES,
  VENUE_CAPACITY_RANGE_MESSAGE,
  VENUE_LAYOUTS_CELL_MESSAGE,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { readImportFile } from "./hotel-import.file.js";
import { buildCandidate, headerProblems } from "./hotel-import.js";
import { ROOMS_IMPORT, VENUES_IMPORT } from "./hotel-import.kinds.js";

const file = (...lines: string[]) => new TextEncoder().encode(lines.join("\n"));
const VENUES = HOTEL_IMPORT_TEMPLATES.venues;

describe("the Rooms and Venues templates' headers (D-181)", () => {
  it("hold each file to its own kind's columns", () => {
    expect(headerProblems(["hotelSlug", "name", "unitType"], HOTEL_IMPORT_TEMPLATES.rooms)).toEqual(
      [],
    );
    expect(headerProblems(["hotelSlug", "name", "city"], HOTEL_IMPORT_TEMPLATES.rooms)).toEqual([
      "Unknown column(s): city. Use the template's headers.",
    ]);
    expect(headerProblems(["name", "venueType"], VENUES)).toEqual([
      "Missing column(s): hotelSlug.",
    ]);
  });

  it("refuse a rooms file with no rooms, naming the kind", () => {
    expect(() => readImportFile(file("hotelSlug,name"), ROOMS_IMPORT)).toThrow(
      expect.objectContaining({
        details: [{ path: "file", message: "The file has no room rows." }],
      }),
    );
  });
});

describe("the Rooms and Venues cells", () => {
  it("read an enum cell in any case, spaces and hyphens as underscores", () => {
    const read = readImportFile(
      file("hotelSlug,name,unitType", "synthetic-lake-hotel,Synthetic Tents,Tent-Suite"),
      ROOMS_IMPORT,
    );
    expect(read.rows).toEqual([
      {
        line: 2,
        row: { hotelSlug: "synthetic-lake-hotel", name: "Synthetic Tents", unitType: "tent_suite" },
      },
    ]);
    const venue = buildCandidate(["venueType", "setting"], ["Meeting room", "Semi open"], VENUES);
    expect(venue.values).toEqual({ venueType: "meeting_room", setting: "semi_open" });
  });

  it("read other layouts as Name: max or Name: min-max, split at |", () => {
    const read = buildCandidate(["otherLayouts"], ["Classroom: 120 | U-shape: 30-40"], VENUES);
    expect(read).toEqual({
      values: {
        otherLayouts: [
          { layout: "Classroom", max: 120 },
          { layout: "U-shape", min: 30, max: 40 },
        ],
      },
      problems: [],
    });
  });

  it("refuse a capacity range and an unreadable layouts cell on their own columns, as row errors", () => {
    const read = readImportFile(
      file(
        "hotelSlug,name,capacityBanquet,otherLayouts",
        "synthetic-lake-hotel,Synthetic Lawn,600-700,",
        "synthetic-lake-hotel,Synthetic Hall,,Classroom 120",
        "synthetic-lake-hotel,Synthetic Deck,650,",
      ),
      VENUES_IMPORT,
    );
    expect(read.rejected).toEqual([
      {
        line: 2,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Lawn",
        errors: [{ field: "capacityBanquet", message: VENUE_CAPACITY_RANGE_MESSAGE }],
      },
      {
        line: 3,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Hall",
        errors: [{ field: "otherLayouts", message: VENUE_LAYOUTS_CELL_MESSAGE }],
      },
    ]);
    expect(read.rows.map(({ row }) => row.capacityBanquet)).toEqual([650]);
  });

  it("hold a row to its kind's bounds: an occupancy of 0 and a thirteenth layout are refused", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => `Layout ${i}: 10`).join(" | ");
    const rooms = readImportFile(
      file("hotelSlug,name,maxOccupancy", "synthetic-lake-hotel,Synthetic Suite,0"),
      ROOMS_IMPORT,
    );
    expect(rooms.rejected[0]?.errors).toEqual([expect.objectContaining({ field: "maxOccupancy" })]);
    const venues = readImportFile(
      file("hotelSlug,name,otherLayouts", `synthetic-lake-hotel,Synthetic Hall,${thirteen}`),
      VENUES_IMPORT,
    );
    expect(venues.rejected[0]?.errors).toEqual([
      expect.objectContaining({ field: "otherLayouts" }),
    ]);
  });
});
