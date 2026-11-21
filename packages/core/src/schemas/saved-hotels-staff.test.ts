import { describe, expect, it } from "vitest";

import { savedHotelStaffListQuery, savedHotelStaffView } from "./saved-hotels-staff.js";

const UUID = "0192f1a0-0000-7000-8000-000000000000";

const ROW = {
  id: UUID,
  hotel: {
    id: UUID,
    name: "The Lake Pavilion",
    starCategory: "5",
    status: "active",
    destinationName: "Udaipur",
  },
  account: { id: UUID, name: "Mehta family" },
  note: "Loved the lawn",
  savedAt: "2026-11-21T10:00:00.000Z",
};

describe("savedHotelStaffView", () => {
  it("accepts a saved hotel with its hotel, account and note", () => {
    expect(savedHotelStaffView.parse(ROW)).toEqual(ROW);
    expect(savedHotelStaffView.parse({ ...ROW, note: null }).note).toBeNull();
  });

  it("is strict: an internal hotel field never rides along", () => {
    const withInternal = { ...ROW, hotel: { ...ROW.hotel, internalNotes: "x" } };
    expect(savedHotelStaffView.safeParse(withInternal).success).toBe(false);
  });
});

describe("savedHotelStaffListQuery", () => {
  it("defaults the page to 50 and coerces the limit", () => {
    expect(savedHotelStaffListQuery.parse({}).limit).toBe(50);
    expect(savedHotelStaffListQuery.parse({ limit: "10" }).limit).toBe(10);
  });

  it("takes an optional account id and refuses a malformed one", () => {
    expect(savedHotelStaffListQuery.parse({ accountId: UUID }).accountId).toBe(UUID);
    expect(savedHotelStaffListQuery.safeParse({ accountId: "x" }).success).toBe(false);
  });

  it("takes an optional hotel id and refuses a malformed one", () => {
    expect(savedHotelStaffListQuery.parse({ hotelId: UUID }).hotelId).toBe(UUID);
    expect(savedHotelStaffListQuery.parse({}).hotelId).toBeUndefined();
    expect(savedHotelStaffListQuery.safeParse({ hotelId: "x" }).success).toBe(false);
  });
});
