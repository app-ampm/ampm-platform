import { describe, expect, it } from "vitest";

import { changedRequestFields, columnUnits, sameValue } from "./hotel-changes.js";

describe("sameValue", () => {
  it("keeps a latitude to 6 places and a distance to 1", () => {
    expect(sameValue("latitude", 24.5760001, 24.576)).toBe(true);
    expect(sameValue("latitude", 24.57601, 24.576)).toBe(false);
    expect(sameValue("airportDistanceKm", 12.5, 12.5)).toBe(true);
    expect(sameValue("totalRooms", 40, null)).toBe(false);
  });

  it("rounds a seventh decimal half away from zero, as the numeric(9,6) column stores it", () => {
    expect(sameValue("latitude", 8.1864485, 8.186449)).toBe(true);
    expect(sameValue("latitude", 32.1848615, 32.184862)).toBe(true);
    expect(sameValue("longitude", -73.0215195, -73.02152)).toBe(true);
    expect(sameValue("latitude", 8.1864485, 8.186448)).toBe(false);
  });

  it("compares lists entry by entry, text trimmed and a postal code without its spaces", () => {
    expect(sameValue("cuisines", ["Indian", "Goan"], ["Indian", "Goan"])).toBe(true);
    expect(sameValue("cuisines", ["Goan", "Indian"], ["Indian", "Goan"])).toBe(false);
    expect(sameValue("city", "Udaipur", " Udaipur ")).toBe(true);
    expect(sameValue("postalCode", "313001", "313 001")).toBe(true);
    expect(sameValue("bookingNotes", null, null)).toBe(true);
    expect(sameValue("bookingNotes", null, "Synthetic note")).toBe(false);
  });
});

describe("columnUnits", () => {
  it("rounds the decimal form PostgreSQL is sent, exponent forms included", () => {
    expect(columnUnits(8.1864485, 6)).toBe(8186449n);
    expect(columnUnits(-8.1864485, 6)).toBe(-8186449n);
    expect(columnUnits(5e-7, 6)).toBe(1n);
    expect(columnUnits(4e-7, 6)).toBe(0n);
    expect(columnUnits(12.5, 1)).toBe(125n);
    expect(columnUnits(Number.NaN, 6)).toBeNull();
  });
});

describe("changedRequestFields", () => {
  const stored = {
    destinationId: "0192f1a0-0000-7000-8000-0000000000a2",
    minNights: 2,
    city: "Udaipur",
    latitude: 24.576,
    bookingNotes: "Synthetic booking note",
    cuisines: ["Indian"],
    brand: null,
  };

  it("names only the fields whose value differs from what is stored, a cleared one included", () => {
    expect(
      changedRequestFields(
        {
          destinationId: stored.destinationId,
          minNights: 3,
          city: "Udaipur",
          latitude: 24.5760001,
          bookingNotes: null,
          cuisines: ["Indian"],
          brand: null,
        },
        stored,
      ),
    ).toEqual(["minNights", "bookingNotes"]);
  });

  it("names a move to another destination first", () => {
    const moved = "0192f1a0-0000-7000-8000-0000000000c2";
    expect(changedRequestFields({ destinationId: moved, city: "Jaipur" }, stored)).toEqual([
      "destinationId",
      "city",
    ]);
  });
});
