import { describe, expect, it } from "vitest";

import {
  destinationCreateRequest,
  hotelContactCreateRequest,
  hotelCreateRequest,
  hotelImportRow,
  hotelUpdateRequest,
  venueCreateRequest,
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

describe("venueCreateRequest", () => {
  it("requires a known venueType and an isIndoor flag", () => {
    expect(venueCreateRequest.safeParse({ name: "Lawn A", isIndoor: false }).success).toBe(false);
    expect(
      venueCreateRequest.safeParse({ name: "Lawn A", venueType: "meadow", isIndoor: false })
        .success,
    ).toBe(false);
    expect(
      venueCreateRequest.safeParse({ name: "Lawn A", venueType: "lawn", isIndoor: false }).success,
    ).toBe(true);
  });
});

describe("hotelContactCreateRequest", () => {
  it("lowercases the email and defaults isPrimary to false", () => {
    const c = hotelContactCreateRequest.parse({ name: "Sales desk", email: "SALES@Example.com" });
    expect(c.email).toBe("sales@example.com");
    expect(c.isPrimary).toBe(false);
  });
});

describe("hotelImportRow", () => {
  const row = { destinationSlug: "udaipur", name: "The Lake Pavilion" };

  it("accepts a minimal row (destination slug + name)", () => {
    expect(hotelImportRow.parse(row)).toMatchObject(row);
  });

  it("validates already-typed values — a string where a number belongs is rejected", () => {
    // The API's CSV parser coerces cells before this runs; a non-coercible value is a field error.
    expect(hotelImportRow.safeParse({ ...row, totalRooms: "many" }).success).toBe(false);
    expect(hotelImportRow.safeParse({ ...row, totalRooms: 84 }).success).toBe(true);
  });

  it("rejects an unknown column and a bad destination slug", () => {
    expect(hotelImportRow.safeParse({ ...row, mystery: "x" }).success).toBe(false);
    expect(hotelImportRow.safeParse({ destinationSlug: "Not Kebab", name: "x" }).success).toBe(
      false,
    );
  });
});
