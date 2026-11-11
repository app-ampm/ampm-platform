import type {
  EntitlementModule,
  HotelCardSummary,
  HotelDestinationView,
  HotelDetailView,
  HotelView,
  MeResponse,
  SavedHotelView,
} from "@ampm/core";

export { offlineFetch, pendingFetch, renderWithApi } from "../../test/api";

/*
 * Shared by the hotels screens' tests: canned API answers, a recording fake fetch and the fixtures. The
 * shapes are exactly what the API sends, so every screen parses them through the real schemas. The
 * render under the API and the never-answering and offline fetches are the app's (src/test/api).
 */

export interface ApiReply {
  readonly status: number;
  readonly body: unknown;
}

/** Answers one request, or undefined for the fake's 404. */
export type ApiHandler = (method: string, url: URL) => ApiReply | undefined;

export function ok(data: unknown): ApiReply {
  return { status: 200, body: { data } };
}

export function fail(code: string, status: number): ApiReply {
  return { status, body: { error: { code, message: code } } };
}

function urlOf(input: RequestInfo | URL): URL {
  if (typeof input === "string") return new URL(input);
  return input instanceof URL ? input : new URL(input.url);
}

/**
 * A fetch that answers through `handler` (anything it does not know is a 404, a handled denial) and
 * records each call as "GET /hotels?limit=50".
 */
export function fakeApi(handler: ApiHandler): { readonly fetch: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}${url.search}`);
    const reply = handler(method, url) ?? fail("not_found", 404);
    return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status }));
  };
  return { fetch: fakeFetch, calls };
}

export const HOTEL_ID = "018f0000-0000-7000-8000-00000000beef";

export const UDAIPUR: HotelDestinationView = {
  id: "018f0000-0000-7000-8000-000000000000",
  name: "Udaipur",
  slug: "udaipur",
  region: null,
  state: "Rajasthan",
  country: "India",
};

export const JAIPUR: HotelDestinationView = {
  id: "018f0000-0000-7000-8000-000000000001",
  name: "Jaipur",
  slug: "jaipur",
  region: null,
  state: "Rajasthan",
  country: "India",
};

/** A card summary (B11) as `GET /hotels` derives it: a verified room-rate range and a venue capacity range. */
export function summaryFixture(overrides: Partial<HotelCardSummary> = {}): HotelCardSummary {
  return {
    ratesFreshness: "verified",
    ratesAsOf: "2026-11-02T06:30:00.000Z",
    priceRange: {
      min: { minor: 1800000, currency: "INR" },
      max: { minor: 2400000, currency: "INR" },
      unit: "per_night",
    },
    capacity: { min: 500, max: 900 },
    ...overrides,
  };
}

/** A hotel card as `GET /hotels` lists it. */
export function hotelFixture(overrides: Partial<HotelView> = {}): HotelView {
  return {
    id: HOTEL_ID,
    slug: "lake-pavilion-udaipur",
    name: "The Lake Pavilion",
    brand: null,
    starCategory: "5",
    destination: UDAIPUR,
    address: "Lake Road, Udaipur",
    description: "A heritage-style lakeside palace for destination weddings.",
    website: null,
    totalRooms: 84,
    streetViewRef: null,
    lastVerifiedAt: null,
    coverUrl: null,
    summary: summaryFixture(),
    ...overrides,
  };
}

/** A signed cover-thumbnail link as the API mints one — relative to the API origin for the local store. */
export const COVER_URL = "/media/blob?key=hotel/cover.thumb&exp=4102444800&sig=abc";

/** The exact shape `GET /hotels/:id` returns: the card plus its rates, gallery and references. */
export function detailFixture(overrides: Partial<HotelDetailView> = {}): HotelDetailView {
  return {
    ...hotelFixture(),
    rates: { status: "on_request", asOf: null, items: [] },
    venues: [],
    rooms: [],
    gallery: [],
    references: [],
    ...overrides,
  };
}

/** A shortlist entry as `GET /hotels/saved` lists it. */
export function savedFixture(hotel: HotelView, id: string): SavedHotelView {
  return { id, hotel, note: null, savedAt: "2026-11-02T06:30:00.000Z" };
}

/** The `GET /hotels/saved/ids` body: every hotel id on the shortlist (the heart's reliable saved state). */
export function savedIds(ids: readonly string[]): { readonly ids: string[] } {
  return { ids: [...ids] };
}

/** A page of a cursor-paginated list. */
export function pageOf<T>(items: readonly T[], nextCursor: string | null = null) {
  return { items, nextCursor };
}

/** A signed-in client with these entitlement modules. */
export function clientMe(modules: readonly EntitlementModule[]): MeResponse {
  return {
    principal: {
      type: "client",
      userId: "018f0000-0000-7000-8000-0000000000d2",
      name: "Ananya Sharma",
      email: "ananya@example.com",
      phone: null,
      status: "active",
      lastLoginAt: null,
    },
    roles: [],
    memberships: [],
    entitlements: {
      modules: [...modules],
      readOnlyModules: [],
      hotelReach: ["all_hotels"],
      financeReach: [],
      requestTypes: { wedding: [], account: [] },
    },
    isDemo: false,
  };
}
