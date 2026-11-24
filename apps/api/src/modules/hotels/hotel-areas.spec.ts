import { HOTEL_AREA_PAIRS, ROOM_AREA_PAIRS, VENUE_AREA_PAIRS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import { settleAreas } from "./hotel-areas.js";
import { toVenueLayouts, venueLayoutsInput } from "./hotel-venue-layouts.js";

describe("settleAreas: the units write rule on each area pair (D-178)", () => {
  it("derives m² from a filled sq ft, replacing an m² sent beside it", () => {
    expect(settleAreas({ sizeSqft: 850, sizeSqm: 99 }, ROOM_AREA_PAIRS, null)).toEqual({
      sizeSqft: 850,
      sizeSqm: 79,
    });
    expect(settleAreas({ totalEventSpaceSqft: 12_000 }, HOTEL_AREA_PAIRS, null)).toEqual({
      totalEventSpaceSqft: 12_000,
      totalEventSpaceSqm: 1_115,
    });
  });

  it("publishes an m² written alone on a row that stores sq ft, clearing the sq ft", () => {
    expect(settleAreas({ areaSqm: 400 }, VENUE_AREA_PAIRS, { areaSqft: 5_000 })).toEqual({
      areaSqm: 400,
      areaSqft: null,
    });
    expect(settleAreas({ areaSqm: 400 }, VENUE_AREA_PAIRS, { areaSqft: null })).toEqual({
      areaSqm: 400,
    });
  });

  it("leaves the stored m² when a write clears only the sq ft, and leaves a blank pair alone", () => {
    expect(settleAreas({ sizeSqft: null }, ROOM_AREA_PAIRS, { sizeSqft: 500 })).toEqual({
      sizeSqft: null,
    });
    expect(settleAreas({ roomCount: 4 }, ROOM_AREA_PAIRS, { sizeSqft: 500 })).toEqual({
      roomCount: 4,
    });
  });

  it("settles each of a venue's pairs on its own", () => {
    const settled = settleAreas({ areaSqft: 5_000, prefunctionAreaSqm: 80 }, VENUE_AREA_PAIRS, {
      areaSqft: null,
      prefunctionAreaSqft: 1_000,
    });
    expect(settled).toEqual({
      areaSqft: 5_000,
      areaSqm: 465,
      prefunctionAreaSqm: 80,
      prefunctionAreaSqft: null,
    });
  });
});

describe("a venue's other layouts in their JSON column", () => {
  it("writes each entry with one key order and no empty minimum, SQL NULL for null", () => {
    expect(venueLayoutsInput([{ layout: "Classroom", max: 120, min: undefined }])).toEqual([
      { layout: "Classroom", max: 120 },
    ]);
    expect(venueLayoutsInput(null)).toBe(Prisma.DbNull);
    expect(venueLayoutsInput(undefined)).toBeUndefined();
  });

  it("reads them back narrowed, dropping an entry that is not a layout", () => {
    const stored: Prisma.JsonValue = [
      { layout: "U-shape", max: 40, min: 30 },
      { layout: "Classroom", max: 120 },
      { layout: "Broken" },
      "stray",
    ];
    expect(toVenueLayouts(stored)).toEqual([
      { layout: "U-shape", max: 40, min: 30 },
      { layout: "Classroom", max: 120 },
    ]);
    expect(toVenueLayouts(null)).toBeNull();
    expect(toVenueLayouts({ layout: "Not a list", max: 1 })).toBeNull();
  });
});
