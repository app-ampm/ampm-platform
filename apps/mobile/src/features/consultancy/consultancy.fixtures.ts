import type {
  HotelDetailView,
  HotelEnquiryClientDetailView,
  HotelEnquiryClientView,
  HotelProposalClientView,
} from "@ampm/core";

import { TEST_API_BASE } from "../../test/api";

/*
 * Test data for the consultancy screens' tests: wire payloads in the exact shapes the client views
 * parse, and a fake `fetch` that answers by method and path. Synthetic data only (security.md).
 */

/** The base the fake fetch strips: the one the shared render gives the ApiProvider. */
export const API_BASE = TEST_API_BASE;
export const HOTEL_ID = "018f0000-0000-7000-8000-00000000beef";
export const OTHER_HOTEL_ID = "018f0000-0000-7000-8000-00000000bee2";
export const ENQUIRY_ID = "018f0000-0000-7000-8000-0000000000e1";
export const CLOSED_ENQUIRY_ID = "018f0000-0000-7000-8000-0000000000e2";
export const PROPOSAL_ID = "018f0000-0000-7000-8000-0000000000c1";

const AT = "2026-11-03T10:00:00.000Z";

/** `GET /hotels/:id`: the client card plus the detail's rates, gallery and references. Typed as the
 * client detail view so a change to the shared hotel schema fails here at compile time, not only at
 * runtime when the screens parse it. */
export const HOTEL: HotelDetailView = {
  id: HOTEL_ID,
  slug: "lake-pavilion-udaipur",
  name: "The Lake Pavilion",
  brand: null,
  starCategory: "5",
  destination: {
    id: "018f0000-0000-7000-8000-000000000000",
    name: "Udaipur",
    slug: "udaipur",
    region: null,
    state: "Rajasthan",
    country: "India",
  },
  address: "Lake Road, Udaipur",
  description: "A heritage-style lakeside palace for destination weddings.",
  website: null,
  totalRooms: 84,
  streetViewRef: null,
  lastVerifiedAt: null,
  coverUrl: null, // empty gallery ⟹ the server derives no cover
  summary: { ratesFreshness: "on_request", ratesAsOf: null, priceRange: null, capacity: null },
  rates: { status: "on_request", asOf: null, items: [] },
  venues: [],
  rooms: [],
  gallery: [],
  references: [],
};

/** An enquiry waiting on the client's decision on a shared proposal. */
export const ENQUIRY: HotelEnquiryClientView = {
  id: ENQUIRY_ID,
  hotelId: HOTEL_ID,
  projectId: null,
  status: "client_decision",
  dateFrom: "2027-02-12",
  dateTo: "2027-02-14",
  datesFlexible: false,
  guestEstimate: 300,
  roomsRequired: 80,
  functionsSummary: "Sangeet, wedding, reception",
  contactPreference: null,
  notesClient: null,
  outcome: null,
  submittedAt: AT,
  closedAt: null,
  createdAt: AT,
  updatedAt: AT,
};

/** An enquiry the hotel could not take: closed with no availability. */
export const CLOSED_ENQUIRY: HotelEnquiryClientView = {
  ...ENQUIRY,
  id: CLOSED_ENQUIRY_ID,
  hotelId: OTHER_HOTEL_ID,
  status: "closed",
  outcome: "no_availability",
  dateFrom: "2027-02-28",
  dateTo: "2027-03-02",
  guestEstimate: 1,
  roomsRequired: null,
  closedAt: AT,
};

export const ENQUIRY_DETAIL: HotelEnquiryClientDetailView = {
  ...ENQUIRY,
  events: [
    {
      id: "018f0000-0000-7000-8000-0000000000d1",
      eventType: "hotel_response",
      occurredAt: AT,
      summary: "The lawn is free on the 13th and holds 350 for a sangeet.",
    },
  ],
};

const inr = (minor: number) => ({ minor, currency: "INR" as const });

/** Version 2, shared with the client and waiting on their decision. */
export const SHARED_PROPOSAL: HotelProposalClientView = {
  id: PROPOSAL_ID,
  enquiryId: ENQUIRY_ID,
  hotelId: HOTEL_ID,
  versionNumber: 2,
  status: "shared",
  validUntil: "2026-11-20",
  clientTotal: inr(705_000_000),
  currency: "INR",
  documentId: null,
  sharedAt: AT,
  decidedAt: null,
  supersedesProposalId: null,
  createdAt: AT,
  updatedAt: AT,
  lines: [
    {
      id: "018f0000-0000-7000-8000-0000000000b1",
      itemType: "room_rate",
      description: "Rooms, 3 nights",
      quantity: 80,
      unitAmount: inr(5_850_000),
      totalAmount: inr(468_000_000),
    },
  ],
};

export const page = (items: readonly unknown[]) => ({ items, nextCursor: null });

/** One answer of the fake API: an envelope and its HTTP status. */
export interface FakeResponse {
  readonly status: number;
  readonly body: unknown;
}

export const ok = (data: unknown): FakeResponse => ({ status: 200, body: { data } });

export const fail = (status: number, code: string, message = code): FakeResponse => ({
  status,
  body: { error: { code, message } },
});

/** A request the fake API received: "POST /consultancy/enquiries" and its parsed JSON body. */
export interface FakeCall {
  readonly route: string;
  readonly body: unknown;
}

/**
 * A `fetch` that answers "METHOD /path" (the query string ignored) from `routes`, records each call
 * in `calls`, and answers anything else with the API's 404 envelope.
 */
export function fakeApi(
  routes: Readonly<Record<string, FakeResponse>>,
  calls: FakeCall[] = [],
): typeof fetch {
  return (input, init) => {
    const url = typeof input === "string" ? input : String(input);
    const path = url.slice(API_BASE.length).split("?")[0] ?? "";
    const route = `${init?.method ?? "GET"} ${path}`;
    calls.push({ route, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const answer = routes[route] ?? fail(404, "not_found", "Not found");
    return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status }));
  };
}
