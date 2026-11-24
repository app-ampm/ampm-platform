import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { NUL_TEXT_MESSAGE } from "./common.js";
import {
  destinationCreateRequest,
  hotelContactCreateRequest,
  hotelContactUpdateRequest,
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

// PostgreSQL stores no U+0000 in text, varchar or jsonb, and text copied from a PDF can carry one: the
// edge refuses it on its field, a 400 rather than a database error (a bare 500). The hotel profile shows
// a facility's refusal under that field; the room, venue and contact sheets strip the character first.
describe("text holding the null character", () => {
  const NUL = "\u0000";
  const venue = { name: "Synthetic Hall", venueType: "ballroom", setting: "indoor" };
  const cases: readonly (readonly [string, z.ZodType, object, readonly (string | number)[]])[] = [
    ["a room's name", roomCategoryCreateRequest, { name: `Deluxe${NUL}` }, ["name"]],
    ["a room's view", roomCategoryUpdateRequest, { viewLabel: `Lake${NUL}` }, ["viewLabel"]],
    [
      "a room's bed configuration",
      roomCategoryUpdateRequest,
      { bedConfiguration: `King${NUL}` },
      ["bedConfiguration"],
    ],
    [
      "a room's description",
      roomCategoryUpdateRequest,
      { description: `Quiet${NUL}` },
      ["description"],
    ],
    [
      "a facility entry",
      roomCategoryUpdateRequest,
      { facilities: ["Pool", `Spa${NUL}`] },
      ["facilities", 1],
    ],
    ["a venue's name", venueCreateRequest, { ...venue, name: `Hall${NUL}` }, ["name"]],
    [
      "a venue's capacity notes",
      venueUpdateRequest,
      { capacityNotes: `Seated 300${NUL}` },
      ["capacityNotes"],
    ],
    [
      "a venue's description",
      venueUpdateRequest,
      { description: `Pillarless${NUL}` },
      ["description"],
    ],
    [
      "a layout name",
      venueUpdateRequest,
      { otherLayouts: [{ layout: `U${NUL}shape`, max: 40 }] },
      ["otherLayouts", 0, "layout"],
    ],
    ["a contact's name", hotelContactCreateRequest, { name: `Desk${NUL}` }, ["name"]],
    ["a contact's role", hotelContactUpdateRequest, { roleTitle: `Sales${NUL}` }, ["roleTitle"]],
    ["a contact's phone", hotelContactUpdateRequest, { phone: `0141 234 5678${NUL}` }, ["phone"]],
  ];

  it.each(cases)("refuses %s on its own field", (_case, schema, body, path) => {
    const result = schema.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: [...path], message: NUL_TEXT_MESSAGE }),
    );
  });

  it("still takes the same text without it", () => {
    expect(roomCategoryUpdateRequest.parse({ viewLabel: " Lake view " }).viewLabel).toBe(
      "Lake view",
    );
    expect(venueUpdateRequest.safeParse({ capacityNotes: "Seated 300" }).success).toBe(true);
  });
});
