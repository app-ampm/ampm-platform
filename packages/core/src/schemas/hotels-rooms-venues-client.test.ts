import { describe, expect, it } from "vitest";

import { hotelRoomClientView, hotelVenueClientView, hotelVenueType } from "./hotels.js";

/*
 * The client views of rooms and venues in Slice 3 (D-178): only the venue-type enum widens (a client
 * contract change, shipped API and web back to back); the new staff fields stay out until Slice 12.
 */

const venue = {
  id: "0192f1a0-0000-7000-8000-000000000011",
  name: "Synthetic Garden",
  venueType: "garden",
  isIndoor: false,
  areaSqm: 900,
  capacityBanquet: 400,
  capacityTheatre: null,
  capacityReception: 650,
  facilities: null,
  description: null,
};

const room = {
  id: "0192f1a0-0000-7000-8000-000000000012",
  name: "Synthetic Garden Cottage",
  roomCount: 8,
  maxOccupancy: 3,
  sizeSqm: 45,
  facilities: null,
  description: null,
};

describe("hotelVenueType", () => {
  it("appends the five fact-sheet kinds after other, as PostgreSQL holds them", () => {
    expect(hotelVenueType.options).toEqual([
      "ballroom",
      "lawn",
      "poolside",
      "rooftop",
      "courtyard",
      "beach",
      "other",
      "terrace",
      "garden",
      "amphitheatre",
      "meeting_room",
      "lounge",
    ]);
  });
});

describe("the client venue and room views (Slice 3)", () => {
  it.each(["terrace", "garden", "amphitheatre", "meeting_room", "lounge"])(
    "show a %s venue",
    (venueType) => {
      expect(hotelVenueClientView.safeParse({ ...venue, venueType }).success).toBe(true);
    },
  );

  it.each([
    ["setting", "semi_open"],
    ["areaSqft", 9_700],
    ["lengthM", 30],
    ["otherLayouts", [{ layout: "Cluster", max: 120 }]],
    ["prefunctionAreaSqm", 100],
    ["capacityNotes", "600 to 650 floating"],
  ])("keep the staff venue field %s out", (key, value) => {
    expect(hotelVenueClientView.safeParse({ ...venue, [key]: value }).success).toBe(false);
  });

  it.each([
    ["unitType", "cottage"],
    ["viewLabel", "Garden"],
    ["bedConfiguration", "Two twin beds"],
    ["sizeSqft", 484],
  ])("keep the staff room field %s out", (key, value) => {
    expect(hotelRoomClientView.safeParse(room).success).toBe(true);
    expect(hotelRoomClientView.safeParse({ ...room, [key]: value }).success).toBe(false);
  });
});
