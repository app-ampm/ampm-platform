import { describe, expect, it } from "vitest";

import {
  destinationCreateRequest,
  hotelContactCreateRequest,
  hotelCreateRequest,
  hotelUpdateRequest,
  roomCategoryCreateRequest,
  roomCategoryUpdateRequest,
  venueCreateRequest,
  venueUpdateRequest,
} from "./hotels-admin.js";

const UUID = "0192f1a0-0000-7000-8000-000000000000";

describe("destinationCreateRequest", () => {
  it("defaults country, status and visibility; slug is optional", () => {
    const d = destinationCreateRequest.parse({ name: "Udaipur" });
    expect(d.country).toBe("India");
    expect(d.status).toBe("draft");
    expect(d.publicVisible).toBe(false);
    expect(d.slug).toBeUndefined();
  });

  it("rejects a non-kebab slug", () => {
    expect(destinationCreateRequest.safeParse({ name: "X", slug: "Not A Slug" }).success).toBe(
      false,
    );
    expect(destinationCreateRequest.parse({ name: "X", slug: "udaipur" }).slug).toBe("udaipur");
  });
});

describe("hotelCreateRequest", () => {
  const base = { destinationId: UUID, name: "The Lake Pavilion" };

  it("requires a destinationId and a name", () => {
    expect(hotelCreateRequest.safeParse({ name: "x" }).success).toBe(false);
    expect(hotelCreateRequest.safeParse({ destinationId: UUID }).success).toBe(false);
  });

  it("applies profile defaults", () => {
    const h = hotelCreateRequest.parse(base);
    expect(h.status).toBe("draft");
    expect(h.demoVisible).toBe(false);
    expect(h.publicShowcase).toBe(false);
  });

  it("bounds internalRating to 1..5 and requires a valid website URL", () => {
    expect(hotelCreateRequest.safeParse({ ...base, internalRating: 6 }).success).toBe(false);
    expect(hotelCreateRequest.safeParse({ ...base, internalRating: 4 }).success).toBe(true);
    expect(hotelCreateRequest.safeParse({ ...base, website: "not-a-url" }).success).toBe(false);
  });

  it("is strict — an unknown field is rejected", () => {
    expect(hotelCreateRequest.safeParse({ ...base, rating: 5 }).success).toBe(false);
  });
});

describe("hotelUpdateRequest", () => {
  it("rejects an empty patch", () => {
    expect(hotelUpdateRequest.safeParse({}).success).toBe(false);
  });

  it("accepts a single-field patch", () => {
    expect(hotelUpdateRequest.safeParse({ name: "New name" }).success).toBe(true);
  });
});

describe("roomCategoryCreateRequest and roomCategoryUpdateRequest", () => {
  const room = { name: "Synthetic Lake View Suite" };

  it("takes the D-178 room fields", () => {
    const parsed = roomCategoryCreateRequest.parse({
      ...room,
      unitType: "suite",
      viewLabel: "Lake",
      bedConfiguration: "One king bed",
      sizeSqft: 650,
    });
    expect(parsed.unitType).toBe("suite");
  });

  it("holds the occupancy to 1..100 when stated, and the size to its bounds", () => {
    expect(roomCategoryCreateRequest.safeParse({ ...room, maxOccupancy: 0 }).success).toBe(false);
    expect(roomCategoryCreateRequest.safeParse({ ...room, maxOccupancy: 1 }).success).toBe(true);
    expect(roomCategoryCreateRequest.safeParse({ ...room, maxOccupancy: 101 }).success).toBe(false);
    expect(roomCategoryCreateRequest.safeParse({ ...room, maxOccupancy: null }).success).toBe(true);
    expect(roomCategoryCreateRequest.safeParse({ ...room, sizeSqm: 100_001 }).success).toBe(false);
  });

  it("holds the room count to a hotel's total rooms, so no write overflows the integer column", () => {
    expect(roomCategoryCreateRequest.safeParse({ ...room, roomCount: 100_000 }).success).toBe(true);
    expect(roomCategoryCreateRequest.safeParse({ ...room, roomCount: 100_001 }).success).toBe(
      false,
    );
    expect(roomCategoryUpdateRequest.safeParse({ roomCount: 3_000_000_000 }).success).toBe(false);
  });

  it("patches one field at a time and refuses an empty patch", () => {
    expect(roomCategoryUpdateRequest.safeParse({ sizeSqft: 700 }).success).toBe(true);
    expect(roomCategoryUpdateRequest.safeParse({}).success).toBe(false);
  });
});

describe("venueCreateRequest and venueUpdateRequest", () => {
  const venue = { name: "Synthetic Lawn", venueType: "lawn", setting: "outdoor" };

  it("requires a known venueType and a setting, and no longer takes isIndoor", () => {
    expect(venueCreateRequest.safeParse(venue).success).toBe(true);
    expect(venueCreateRequest.safeParse({ ...venue, venueType: "meadow" }).success).toBe(false);
    expect(
      venueCreateRequest.safeParse({ name: "Synthetic Lawn", venueType: "lawn" }).success,
    ).toBe(false);
    expect(venueCreateRequest.safeParse({ ...venue, isIndoor: false }).success).toBe(false);
  });

  it.each(["terrace", "garden", "amphitheatre", "meeting_room", "lounge"])(
    "accepts the new venue type %s",
    (venueType) => {
      expect(venueCreateRequest.safeParse({ ...venue, venueType }).success).toBe(true);
    },
  );

  it("takes a covered, semi-open setting and holds capacities to 100,000", () => {
    expect(venueCreateRequest.safeParse({ ...venue, setting: "semi_open" }).success).toBe(true);
    expect(venueCreateRequest.safeParse({ ...venue, capacityBanquet: 100_000 }).success).toBe(true);
    expect(venueCreateRequest.safeParse({ ...venue, capacityReception: 100_001 }).success).toBe(
      false,
    );
  });

  it("patches the setting but never clears it, and refuses isIndoor", () => {
    expect(venueUpdateRequest.safeParse({ setting: "indoor" }).success).toBe(true);
    expect(venueUpdateRequest.safeParse({ setting: null }).success).toBe(false);
    expect(venueUpdateRequest.safeParse({ isIndoor: true }).success).toBe(false);
    expect(venueUpdateRequest.safeParse({}).success).toBe(false);
  });
});

describe("hotelContactCreateRequest", () => {
  it("lowercases the email and defaults isPrimary to false", () => {
    const c = hotelContactCreateRequest.parse({ name: "Sales desk", email: "SALES@Example.com" });
    expect(c.email).toBe("sales@example.com");
    expect(c.isPrimary).toBe(false);
  });
});
