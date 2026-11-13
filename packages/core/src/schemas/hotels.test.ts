import { describe, expect, it } from "vitest";

import {
  destinationBrowseItem,
  hotelCardSummary,
  hotelCompareItem,
  hotelCompareQuery,
  hotelDetailView,
  hotelListQuery,
  hotelView,
  savedHotelRemovedResponse,
  savedHotelView,
} from "./hotels.js";

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

const summary = {
  ratesFreshness: "verified" as const,
  ratesAsOf: "2026-11-02T06:30:00.000Z",
  priceRange: {
    min: { minor: 1800000, currency: "INR" },
    max: { minor: 2400000, currency: "INR" },
    unit: "per_night" as const,
  },
  capacity: { min: 500, max: 900 },
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
  coverUrl: null,
  summary,
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

  it("carries a nullable cover link — a signed string or null, never another type", () => {
    // The card cover: a signed thumbnail link (relative for the local store, so a plain string, not a URL).
    expect(
      hotelView.safeParse({ ...hotel, coverUrl: "/media/blob?key=k&exp=1&sig=s" }).success,
    ).toBe(true);
    expect(hotelView.safeParse({ ...hotel, coverUrl: null }).success).toBe(true);
    expect(hotelView.safeParse({ ...hotel, coverUrl: 42 }).success).toBe(false);
    const { coverUrl: _omit, ...withoutCover } = hotel;
    expect(hotelView.safeParse(withoutCover).success).toBe(false); // required (null, not absent)
  });

  it("requires the card summary (B11) — absent is rejected", () => {
    const { summary: _omit, ...withoutSummary } = hotel;
    expect(hotelView.safeParse(withoutSummary).success).toBe(false);
  });
});

describe("hotelCardSummary (B11 — derived card figures, never internal data)", () => {
  it("accepts a freshness label with an indicative range and a capacity range", () => {
    expect(hotelCardSummary.safeParse(summary).success).toBe(true);
  });

  it("accepts an on-request card with no price or capacity", () => {
    expect(
      hotelCardSummary.safeParse({
        ratesFreshness: "on_request",
        ratesAsOf: null,
        priceRange: null,
        capacity: null,
      }).success,
    ).toBe(true);
  });

  it("is strict — rejects a non-freshness status or any extra field", () => {
    // "confirmed" is a Module D quotation, never discovery pricing; an internal figure must never ride along.
    expect(hotelCardSummary.safeParse({ ...summary, ratesFreshness: "confirmed" }).success).toBe(
      false,
    );
    expect(hotelCardSummary.safeParse({ ...summary, internalCost: 100 }).success).toBe(false);
  });
});

describe("hotelDetailView (GET /hotels/:id — the card plus rates, venues, rooms, gallery, references)", () => {
  // The exact shape the detail endpoint returns for a hotel with no verified rates or media — the
  // on_request/empty case that must still render (AC-04). Regression for the client reading the detail
  // endpoint with the strict card schema hotelView, which rejects these keys and throws (empty discovery
  // detail: the hook must parse with hotelDetailView, not hotelView).
  const detail = {
    ...hotel,
    rates: { status: "on_request", asOf: null, items: [] },
    facilities: [],
    venues: [],
    rooms: [],
    gallery: [],
    references: [],
  };

  const venue = {
    id: "018f0000-0000-7000-8000-000000000a01",
    name: "The Durbar Ballroom",
    venueType: "ballroom",
    isIndoor: true,
    areaSqm: 1200,
    capacityBanquet: 500,
    capacityTheatre: 700,
    capacityReception: 900,
    facilities: ["Stage", "Dance floor"],
    description: "A pillarless hall.",
  };

  const roomCategory = {
    id: "018f0000-0000-7000-8000-000000000b01",
    name: "Lake-View Suite",
    roomCount: 24,
    maxOccupancy: 3,
    sizeSqm: 65,
    facilities: ["Balcony"],
    description: "Corner suites.",
  };

  it("accepts the detail payload, with or without venues and rooms", () => {
    expect(hotelDetailView.safeParse(detail).success).toBe(true);
    expect(
      hotelDetailView.safeParse({ ...detail, venues: [venue], rooms: [roomCategory] }).success,
    ).toBe(true);
  });

  it("requires the venues and rooms arrays (absent is not the same as empty)", () => {
    const { venues: _venues, ...withoutVenues } = detail;
    expect(hotelDetailView.safeParse(withoutVenues).success).toBe(false);
    const { rooms: _rooms, ...withoutRooms } = detail;
    expect(hotelDetailView.safeParse(withoutRooms).success).toBe(false);
  });

  it("carries the hotel's combined facilities as a required string array (B14)", () => {
    expect(
      hotelDetailView.safeParse({ ...detail, facilities: ["Spa", "Valet parking"] }).success,
    ).toBe(true);
    const { facilities: _facilities, ...withoutFacilities } = detail;
    expect(hotelDetailView.safeParse(withoutFacilities).success).toBe(false);
    expect(hotelDetailView.safeParse({ ...detail, facilities: [42] }).success).toBe(false);
  });

  it("is strict over each venue and room, so no restricted or extra field rides along (security.md)", () => {
    expect(
      hotelDetailView.safeParse({ ...detail, venues: [{ ...venue, internalNotes: "x" }] }).success,
    ).toBe(false);
    expect(
      hotelDetailView.safeParse({ ...detail, rooms: [{ ...roomCategory, costPerNight: 1 }] })
        .success,
    ).toBe(false);
  });

  it("is not a hotelView — the strict card schema rejects the detail's extra keys", () => {
    expect(hotelView.safeParse(detail).success).toBe(false);
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

  it("coerces the numeric discovery filters and the verifiedRatesOnly flag (feature 9.4)", () => {
    const parsed = hotelListQuery.parse({
      star: "5",
      minRooms: "100",
      minGuestCapacity: "500",
      verifiedRatesOnly: "true",
    });
    expect(parsed).toMatchObject({
      star: "5",
      minRooms: 100,
      minGuestCapacity: 500,
      verifiedRatesOnly: true,
    });
    expect(hotelListQuery.parse({ verifiedRatesOnly: "false" }).verifiedRatesOnly).toBe(false);
    // Strict: only true/false, and a negative minimum is rejected at the edge.
    expect(hotelListQuery.safeParse({ verifiedRatesOnly: "1" }).success).toBe(false);
    expect(hotelListQuery.safeParse({ minRooms: "-1" }).success).toBe(false);
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

describe("destinationBrowseItem", () => {
  it("carries the client destination fields plus a hotelCount, and is strict (feature 9.4b)", () => {
    const item = { ...destination, hotelCount: 5 };
    expect(destinationBrowseItem.safeParse(item).success).toBe(true);
    expect(destinationBrowseItem.safeParse({ ...item, extra: 1 }).success).toBe(false);
    expect(destinationBrowseItem.safeParse(destination).success).toBe(false); // hotelCount is required
  });
});

describe("hotelCompareItem (feature 9.4c)", () => {
  const rates = { status: "on_request", asOf: null, items: [] };

  it("is the client card plus rates — no gallery, references, or restricted field", () => {
    expect(hotelCompareItem.safeParse({ ...hotel, rates }).success).toBe(true);
    // Deliberately lighter than the detail: the detail's gallery/references are not part of a compare item.
    expect(hotelCompareItem.safeParse({ ...hotel, rates, gallery: [] }).success).toBe(false);
    expect(hotelCompareItem.safeParse({ ...hotel, rates, references: [] }).success).toBe(false);
    // Strict over the embedded hotel view, so no RESTRICTED field can ride along either (security.md).
    expect(hotelCompareItem.safeParse({ ...hotel, rates, internalNotes: "x" }).success).toBe(false);
    expect(hotelCompareItem.safeParse(hotel).success).toBe(false); // rates is required
  });
});

describe("hotelCompareQuery (feature 9.4c)", () => {
  const A = ID;
  const B = HOTEL_ID;
  const C = "018f0000-0000-7000-8000-00000000cafe";
  const D = "018f0000-0000-7000-8000-00000000d00d";
  const E = "018f0000-0000-7000-8000-00000000e00e";

  it("splits a comma list into 2–4 hotel ids, trimming blanks", () => {
    const parsed = hotelCompareQuery.parse({ ids: ` ${A} , ${B} ,, ${C} ` });
    expect(parsed.ids).toEqual([A, B, C]); // trimmed, empty segments dropped
    expect(hotelCompareQuery.parse({ ids: [A, B, C, D].join(",") }).ids).toHaveLength(4); // four is allowed
  });

  it("normalises id case to lowercase, so a non-canonical but valid id still matches the stored one", () => {
    // z.uuid accepts upper/mixed case; the service matches ids against lower-case DB values, so normalise here.
    expect(hotelCompareQuery.parse({ ids: `${A.toUpperCase()},${B}` }).ids).toEqual([A, B]);
  });

  it("requires at least two ids and at most four, each a distinct UUID", () => {
    expect(hotelCompareQuery.safeParse({ ids: A }).success).toBe(false); // one id is not a comparison
    expect(hotelCompareQuery.safeParse({ ids: [A, B, C, D, E].join(",") }).success).toBe(false); // > 4
    expect(hotelCompareQuery.safeParse({ ids: `${A},not-a-uuid` }).success).toBe(false);
    expect(hotelCompareQuery.safeParse({ ids: `${A},${A}` }).success).toBe(false); // duplicate
    expect(hotelCompareQuery.safeParse({ ids: `${A},${A.toUpperCase()}` }).success).toBe(false); // dup after normalise
    expect(hotelCompareQuery.safeParse({ ids: `${A},${B}`, extra: 1 }).success).toBe(false); // strict
  });
});
