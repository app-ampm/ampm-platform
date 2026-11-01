import { describe, expect, it } from "vitest";

import { hotelListQuery, hotelView, savedHotelRemovedResponse, savedHotelView } from "./hotels.js";

const ID = "018f0000-0000-7000-8000-000000000000";
const HOTEL_ID = "018f0000-0000-7000-8000-00000000beef";

const destination = {
  id: ID,
  name: "Udaipur",
  slug: "udaipur",
  region: null,
  state: "Rajasthan",
  country: "India",
};

const hotel = {
  id: HOTEL_ID,
  slug: "lake-pavilion-udaipur",
  name: "The Lake Pavilion",
  brand: null,
  starCategory: "5",
  destination,
  address: "Lake Road, Udaipur",
  description: "A heritage-style lakeside palace for destination weddings.",
  website: null,
  totalRooms: 84,
  streetViewRef: null,
  lastVerifiedAt: null,
};

describe("hotelView (one client model per audience — security.md)", () => {
  it("accepts a hotel carrying only PUBLIC/CLIENT-class fields", () => {
    expect(hotelView.safeParse(hotel).success).toBe(true);
  });

  it("rejects RESTRICTED-NOTES and lifecycle fields, so none can be serialised to a client", () => {
    // internal_rating / internal_notes are RESTRICTED-NOTES; the lifecycle/gating flags are internal too.
    expect(hotelView.safeParse({ ...hotel, internalRating: 4 }).success).toBe(false);
    expect(hotelView.safeParse({ ...hotel, internalNotes: "chain rate pending" }).success).toBe(
      false,
    );
    expect(hotelView.safeParse({ ...hotel, status: "active" }).success).toBe(false);
    expect(hotelView.safeParse({ ...hotel, demoVisible: true }).success).toBe(false);
  });
});

describe("hotelListQuery", () => {
  it("validates the cursor as a UUID, so a malformed cursor is a 400 at the edge, not a 500", () => {
    expect(hotelListQuery.safeParse({ cursor: "not-a-uuid" }).success).toBe(false);
    expect(hotelListQuery.safeParse({ cursor: ID }).success).toBe(true);
    expect(hotelListQuery.safeParse({}).success).toBe(true);
  });

  it("rejects a malformed destination filter and trims the search text", () => {
    expect(hotelListQuery.safeParse({ destinationId: "nope" }).success).toBe(false);
    const parsed = hotelListQuery.safeParse({ q: "  lake  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.q).toBe("lake");
  });
});

describe("savedHotelView", () => {
  it("embeds the client hotel view and carries no account/user ownership plumbing", () => {
    const saved = { id: ID, hotel, note: null, savedAt: "2026-11-01T00:00:00.000Z" };
    expect(savedHotelView.safeParse(saved).success).toBe(true);
    expect(savedHotelView.safeParse({ ...saved, accountId: ID }).success).toBe(false);
    // A restricted hotel field cannot sneak in through the embedded view either.
    expect(
      savedHotelView.safeParse({ ...saved, hotel: { ...hotel, internalNotes: "x" } }).success,
    ).toBe(false);
  });
});

describe("savedHotelRemovedResponse", () => {
  it("is just the hotel id", () => {
    expect(savedHotelRemovedResponse.safeParse({ hotelId: HOTEL_ID }).success).toBe(true);
    expect(savedHotelRemovedResponse.safeParse({ hotelId: "x" }).success).toBe(false);
  });
});
