import { HOTEL_CATALOGUE_KEYS, HOTEL_IMPORT_COLUMNS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import {
  HOTEL_PROFILE_KEYS,
  toHotelUpdatePatch,
  toHotelWriteData,
  toImportPatch,
} from "./hotel-write.js";

const DESTINATION = "0192f1a0-0000-7000-8000-0000000000a2";

/** The keys a patch actually writes: Prisma skips one left undefined. */
const written = (patch: object) =>
  Object.entries(patch)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .sort();

describe("HOTEL_PROFILE_KEYS", () => {
  it("is every import column but the four that key a row, the D-178 ones included", () => {
    const keys = ["destinationSlug", "destinationName", "slug", "imageRef"];
    expect(HOTEL_PROFILE_KEYS).toEqual(HOTEL_IMPORT_COLUMNS.filter((c) => !keys.includes(c)));
    for (const key of HOTEL_CATALOGUE_KEYS) expect(HOTEL_PROFILE_KEYS).toContain(key);
  });
});

describe("toHotelWriteData", () => {
  it("makes a draft hidden from the demo and the showcase unless the fields say otherwise", () => {
    const data = toHotelWriteData({ name: "Synthetic Lake Hotel" }, DESTINATION, "synthetic-lake");
    expect(data).toMatchObject({
      destinationId: DESTINATION,
      slug: "synthetic-lake",
      name: "Synthetic Lake Hotel",
      status: "draft",
      demoVisible: false,
      publicShowcase: false,
    });
    expect(written(data)).toEqual(
      ["demoVisible", "destinationId", "name", "publicShowcase", "slug", "status"].sort(),
    );
  });

  it("writes every D-178 field it is given", () => {
    const data = toHotelWriteData(
      { name: "X", status: "active", city: "Udaipur", minNights: 2, cuisines: ["Indian"] },
      DESTINATION,
      "x",
    );
    expect(data).toMatchObject({
      status: "active",
      city: "Udaipur",
      minNights: 2,
      cuisines: ["Indian"],
    });
  });
});

describe("toHotelUpdatePatch", () => {
  it("writes exactly the fields the request names; a null clears one", () => {
    const patch = toHotelUpdatePatch({ airportDistanceKm: 12.5, bookingNotes: null });
    expect(written(patch)).toEqual(["airportDistanceKm", "bookingNotes"]);
    expect(patch).toMatchObject({ airportDistanceKm: 12.5, bookingNotes: null });
  });

  it("moves the hotel when the request names a destination", () => {
    expect(written(toHotelUpdatePatch({ destinationId: DESTINATION }))).toEqual(["destinationId"]);
  });
});

describe("toImportPatch", () => {
  it("keeps only the changed columns of a row, whatever else it carries", () => {
    const row = {
      name: "Synthetic Lake Hotel",
      city: "Udaipur",
      status: "active",
      minNights: 2,
    } as const;
    const patch = toImportPatch(row, new Set(["city", "minNights"] as const));
    expect(patch).toEqual({ city: "Udaipur", minNights: 2 });
  });
});
