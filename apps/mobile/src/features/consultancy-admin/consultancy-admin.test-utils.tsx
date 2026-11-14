import type {
  BookingMilestoneStaffView,
  HotelEnquiryStaffDetailView,
  HotelEnquiryStaffView,
  SiteVisitStaffView,
} from "@ampm/core";

import { failure, ok, TEST_API_BASE } from "../../test/api";
import { accountViewFixture } from "../accounts/accounts.test-utils";
import { hotelStaffDetailViewFixture } from "../hotels-admin/hotels-admin.test-utils";

export { failure, jsonResponse, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for the staff enquiry screens: records in the exact (strict) shapes the
 * consultancy-admin endpoints return and a fetch that answers by method and path and records what was
 * sent; the render under the API and the envelopes are the app's (src/test/api). Imported by tests
 * only.
 */

export const ENQUIRY_ID = "018f0000-0000-7000-8000-0000000004e1";
export const SECOND_ENQUIRY_ID = "018f0000-0000-7000-8000-0000000004e2";
export const HOTEL_ID = "018f0000-0000-7000-8000-00000000beef";
export const VISIT_ID = "018f0000-0000-7000-8000-0000000005a1";
export const MILESTONE_ID = "018f0000-0000-7000-8000-0000000006b1";
const ACCOUNT_ID = "018f0000-0000-7000-8000-0000000002ac";
const SERVICE_TYPE_ID = "018f0000-0000-7000-8000-0000000003c5";
const CLIENT_USER_ID = "018f0000-0000-7000-8000-0000000000d2";
const STAFF_USER_ID = "018f0000-0000-7000-8000-00000000cafe";
const SUBMITTED_AT = "2026-11-03T09:12:00.000Z";

/** A submitted enquiry for 12–14 Feb 2027, 300 guests, nobody on the team holding it yet. */
export function enquiryFixture(
  overrides: Partial<HotelEnquiryStaffView> = {},
): HotelEnquiryStaffView {
  return {
    id: ENQUIRY_ID,
    hotelId: HOTEL_ID,
    projectId: null,
    status: "submitted",
    dateFrom: "2027-02-12",
    dateTo: "2027-02-14",
    datesFlexible: false,
    guestEstimate: 300,
    roomsRequired: null,
    functionsSummary: "Sangeet, wedding and reception",
    contactPreference: null,
    notesClient: null,
    outcome: null,
    submittedAt: SUBMITTED_AT,
    closedAt: null,
    createdAt: SUBMITTED_AT,
    updatedAt: SUBMITTED_AT,
    accountId: ACCOUNT_ID,
    requestedByUserId: CLIENT_USER_ID,
    assignedUserId: null,
    serviceAgreementId: null,
    notesInternal: null,
    ...overrides,
  };
}

type EnquiryEvent = HotelEnquiryStaffDetailView["events"][number];

/** One timeline event; client-visible unless `internalOnly` says otherwise. */
export function eventFixture(overrides: Partial<EnquiryEvent> = {}): EnquiryEvent {
  return {
    id: "018f0000-0000-7000-8000-0000000007c1",
    enquiryId: ENQUIRY_ID,
    eventType: "submitted",
    occurredAt: SUBMITTED_AT,
    userId: CLIENT_USER_ID,
    summary: null,
    internalOnly: false,
    documentId: null,
    createdAt: SUBMITTED_AT,
    ...overrides,
  };
}

export function detailFixture(
  overrides: Partial<HotelEnquiryStaffDetailView> = {},
): HotelEnquiryStaffDetailView {
  return { ...enquiryFixture(), events: [], ...overrides };
}

/** A proposed site visit on 20 Nov 2026 with the team's internal attendees noted. */
export function visitFixture(overrides: Partial<SiteVisitStaffView> = {}): SiteVisitStaffView {
  return {
    id: VISIT_ID,
    enquiryId: ENQUIRY_ID,
    hotelId: HOTEL_ID,
    scheduledAt: "2026-11-20T05:30:00.000Z",
    status: "proposed",
    clientFeedback: null,
    createdAt: SUBMITTED_AT,
    updatedAt: SUBMITTED_AT,
    attendeesText: "Meera and the hotel's sales manager",
    outcomeInternal: null,
    createdBy: STAFF_USER_ID,
    ...overrides,
  };
}

/** A pending advance payment of ₹9,50,000. */
export function milestoneFixture(
  overrides: Partial<BookingMilestoneStaffView> = {},
): BookingMilestoneStaffView {
  return {
    id: MILESTONE_ID,
    enquiryId: ENQUIRY_ID,
    milestoneType: "advance_paid",
    status: "pending",
    dueAt: null,
    completedAt: null,
    createdAt: SUBMITTED_AT,
    updatedAt: SUBMITTED_AT,
    amount: { minor: 95_000_000, currency: "INR" },
    projectId: null,
    contractId: null,
    documentId: null,
    createdBy: STAFF_USER_ID,
    ...overrides,
  };
}

export type FetchFn = typeof fetch;
export type Route = (init: RequestInit | undefined) => Response;

export const page = (items: readonly unknown[], nextCursor: string | null = null): Response =>
  ok({ items, nextCursor });

/** What a write sent: the method and path it went to, and its parsed JSON body. */
export interface SentRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

/**
 * A fetch that answers by "METHOD /path" (no base, no query); anything else is a 404, as for a
 * stranger. Every request lands in `sent`, so a test can read what a write carried.
 */
export function routedFetch(
  routes: Readonly<Record<string, Route>>,
  sent: SentRequest[] = [],
): FetchFn {
  return (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "").split("?")[0] ?? "";
    const method = init?.method ?? "GET";
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    sent.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    return Promise.resolve(route ? route(init) : failure("not_found", 404));
  };
}

export const HOTEL_NAME = "The Lake Pavilion";
export const CLIENT_NAME = "Ananya Sharma";
const OTHER_HOTEL_ID = "018f0000-0000-7000-8000-00000000b0b0";

/**
 * The queue T6 sets beside the open enquiry: this file's enquiry at The Lake Pavilion for Ananya Sharma,
 * then a newer-looking one waiting on a hotel whose record the reader cannot open, so its card falls
 * back to what is being planned.
 */
export function queueFixture(): HotelEnquiryStaffView[] {
  return [
    enquiryFixture(),
    enquiryFixture({
      id: SECOND_ENQUIRY_ID,
      hotelId: OTHER_HOTEL_ID,
      status: "awaiting_hotel",
      functionsSummary: "Engagement lunch",
      assignedUserId: STAFF_USER_ID,
      guestEstimate: 80,
    }),
  ];
}

/**
 * Every read the queue-and-enquiry workspace makes, answered: the queue, the open enquiry, its hotel and
 * client account, and its (empty) proposals, agreements, visits and milestones, plus the service
 * catalogue the agreement form offers.
 */
export function workspaceRoutes(
  detail: HotelEnquiryStaffDetailView = detailFixture(),
): Record<string, Route> {
  const account = { ...accountViewFixture({ id: ACCOUNT_ID, name: CLIENT_NAME }), contacts: [] };
  return {
    "GET /consultancy-admin/enquiries": () => page(queueFixture()),
    [`GET /consultancy-admin/enquiries/${ENQUIRY_ID}`]: () => ok(detail),
    [`GET /hotels-admin/hotels/${HOTEL_ID}`]: () =>
      ok(hotelStaffDetailViewFixture({ id: HOTEL_ID, name: HOTEL_NAME })),
    [`GET /crm/accounts/${ACCOUNT_ID}`]: () => ok(account),
    "GET /consultancy-admin/proposals": () => page([]),
    "GET /crm/service-agreements": () => page([]),
    "GET /consultancy-admin/site-visits": () => page([]),
    "GET /consultancy-admin/booking-milestones": () => page([]),
    "GET /crm/service-types": () =>
      ok({
        items: [
          {
            id: SERVICE_TYPE_ID,
            serviceKey: "negotiation",
            name: "Rate negotiation",
            category: "hotel_assistance",
          },
        ],
      }),
  };
}
