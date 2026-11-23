import { describe, expect, it } from "vitest";

import {
  HOTEL_CATALOGUE_KEYS,
  hotelCatalogueRequestFields,
  hotelCatalogueViewFields,
} from "./hotel-catalogue.js";
import { hotelCreateRequest, hotelUpdateRequest } from "./hotels-admin.js";

const DESTINATION = "0192f1a0-0000-7000-8000-000000000002";
const base = { destinationId: DESTINATION, name: "Synthetic Lake Hotel" };

describe("the D-178 hotel fields", () => {
  it("lists every request field once, and the views carry the same keys", () => {
    expect([...HOTEL_CATALOGUE_KEYS].sort()).toEqual(
      Object.keys(hotelCatalogueRequestFields).sort(),
    );
    expect(Object.keys(hotelCatalogueViewFields).sort()).toEqual(
      Object.keys(hotelCatalogueRequestFields).sort(),
    );
  });

  it("accepts a full set on create, and leaves every one optional", () => {
    const full = {
      ...base,
      parentGroup: "Synthetic Group",
      nameAliases: ["The Synthetic Lake"],
      locality: "Lakeside",
      city: "Udaipur",
      state: "Rajasthan",
      postalCode: "313001",
      mapsUrl: "https://maps.app.goo.gl/AbC123xyz",
      airportName: "Synthetic Airport",
      airportDistanceKm: 22.5,
      airportDriveMinutes: 35,
      cityCentreDistanceKm: 4,
      totalEventSpaceSqft: 30_000,
      weddingBuyoutPolicy: "depends",
      minRoomsWithoutBuyout: 40,
      minNights: 2,
      parallelFunctions: "not_allowed",
      bookingNotes: "Synthetic note",
      cuisines: ["Indian", "Italian"],
      isPureVegetarian: false,
      hasSeparateVegKitchen: true,
      servesAlcohol: true,
    };
    expect(hotelCreateRequest.safeParse(full).success).toBe(true);
    expect(hotelCreateRequest.safeParse(base).success).toBe(true);
  });

  it("clears a field with null on update", () => {
    expect(hotelUpdateRequest.safeParse({ mapsUrl: null, cuisines: null }).success).toBe(true);
  });

  it.each([
    ["an http Maps link", { mapsUrl: "http://maps.google.com/?q=1,2" }],
    ["a non-Google link", { mapsUrl: "https://example.com/maps" }],
    ["a distance over 999.9 km", { airportDistanceKm: 1000 }],
    ["a distance with two decimals", { railwayDistanceKm: 4.25 }],
    ["a negative distance", { cityCentreDistanceKm: -1 }],
    ["a drive over 600 minutes", { airportDriveMinutes: 601 }],
    ["fractional minutes", { airportDriveMinutes: 12.5 }],
    ["zero minimum nights", { minNights: 0 }],
    ["an unknown buyout policy", { weddingBuyoutPolicy: "sometimes" }],
    ["an unknown parallel-functions value", { parallelFunctions: "maybe" }],
    ["21 name variants", { nameAliases: Array.from({ length: 21 }, (_, i) => `Name ${i}`) }],
    ["the same name variant twice", { nameAliases: ["Lake Hotel", "lake hotel"] }],
    ["the same cuisine twice", { cuisines: ["Indian", "INDIAN"] }],
    ["a postal code over 16 characters", { postalCode: "1".repeat(17) }],
  ])("refuses %s", (_label, field) => {
    expect(hotelUpdateRequest.safeParse(field).success).toBe(false);
  });
});
