import type { ReactElement } from "react";

import type {
  BookingMilestoneStaffView,
  HotelProposalInternalView,
  Money,
  ServiceAgreementStaffView,
  SiteVisitStaffView,
} from "@ampm/core";

import { failure, renderWithApi as renderUnderApi, TEST_API_BASE } from "../../test/api";

export { failure, ok } from "../../test/api";

/*
 * Test fixtures for the staff commercial view and the create forms: one synthetic enquiry's records in
 * the exact wire shapes (the view schemas are strict), a fetch that answers by method and path and keeps
 * what it was sent, and the render under the API (src/test/api) with that fetch.
 */

export const ENQUIRY_ID = "018f0000-0000-7000-8000-0000000000e1";
export const ACCOUNT_ID = "018f0000-0000-7000-8000-0000000000a2";
export const PROPOSAL_ID = "018f0000-0000-7000-8000-0000000000f1";
export const AGREEMENT_ID = "018f0000-0000-7000-8000-0000000000d4";
export const SERVICE_TYPE_ID = "018f0000-0000-7000-8000-0000000000c5";
const HOTEL_ID = "018f0000-0000-7000-8000-0000000000b3";
const STAMP = "2026-11-01T10:00:00.000Z";

function inr(minor: number): Money {
  return { minor, currency: "INR" };
}

type ProposalLine = HotelProposalInternalView["lines"][number];

/** A line the client sees: 60 deluxe rooms at ₹12,000, ₹7,20,000 in all. */
export const CLIENT_LINE: ProposalLine = {
  id: "018f0000-0000-7000-8000-0000000000f2",
  proposalId: PROPOSAL_ID,
  itemType: "room_rate",
  description: "Deluxe rooms, 3 nights",
  quantity: 60,
  unitAmount: inr(1_200_000),
  totalAmount: inr(72_000_000),
  clientVisible: true,
};

/** A line kept off the client view: the hotel's commission, ₹90,000. */
export const INTERNAL_LINE: ProposalLine = {
  id: "018f0000-0000-7000-8000-0000000000f3",
  proposalId: PROPOSAL_ID,
  itemType: "service_charge",
  description: "Hotel commission",
  quantity: 1,
  unitAmount: inr(9_000_000),
  totalAmount: inr(9_000_000),
  clientVisible: false,
};

type ProposalWithoutFinance = Omit<HotelProposalInternalView, "internalTotal" | "margin">;

/** Version 1, a draft for ₹18,50,000, as a staff reader WITHOUT the internal-amount grant gets it. */
export function proposalWithoutGrant(
  overrides: Partial<ProposalWithoutFinance> = {},
): ProposalWithoutFinance {
  return {
    id: PROPOSAL_ID,
    enquiryId: ENQUIRY_ID,
    hotelId: HOTEL_ID,
    versionNumber: 1,
    status: "draft",
    validUntil: "2027-01-31",
    clientTotal: inr(185_000_000),
    currency: "INR",
    documentId: null,
    sharedAt: null,
    decidedAt: null,
    supersedesProposalId: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    decidedByUserId: null,
    approvalId: null,
    createdBy: null,
    lines: [CLIENT_LINE],
    ...overrides,
  };
}

/** The same draft with the grant: internal total ₹17,00,000, margin ₹1,50,000, and both lines. */
export function proposalFixture(
  overrides: Partial<HotelProposalInternalView> = {},
): HotelProposalInternalView {
  return {
    ...proposalWithoutGrant({ lines: [CLIENT_LINE, INTERNAL_LINE] }),
    internalTotal: inr(170_000_000),
    margin: inr(15_000_000),
    ...overrides,
  };
}

/** A draft agreement for rate negotiation: a fixed fee of ₹25,000 on terms 2026-11. */
export function agreementFixture(
  overrides: Partial<ServiceAgreementStaffView> = {},
): ServiceAgreementStaffView {
  return {
    id: AGREEMENT_ID,
    serviceKey: "negotiation",
    serviceName: "Rate negotiation",
    category: "hotel_assistance",
    hotelEnquiryId: ENQUIRY_ID,
    projectId: null,
    scopeText: "Negotiate the room and venue rates and hold 60 rooms",
    fee: inr(2_500_000),
    feeStructure: "fixed",
    termsVersion: "2026-11",
    status: "draft",
    acceptedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    accountId: ACCOUNT_ID,
    serviceTypeId: SERVICE_TYPE_ID,
    acceptedByUserId: null,
    documentId: null,
    createdBy: null,
    ...overrides,
  };
}

/** What `POST /consultancy-admin/booking-milestones` answers. */
export const MILESTONE_CREATED: BookingMilestoneStaffView = {
  id: "018f0000-0000-7000-8000-0000000000a6",
  enquiryId: ENQUIRY_ID,
  milestoneType: "advance_paid",
  status: "pending",
  dueAt: null,
  completedAt: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  amount: null,
  projectId: null,
  contractId: null,
  documentId: null,
  createdBy: null,
};

/** What `POST /consultancy-admin/site-visits` answers. */
export const VISIT_CREATED: SiteVisitStaffView = {
  id: "018f0000-0000-7000-8000-0000000000a7",
  enquiryId: ENQUIRY_ID,
  hotelId: HOTEL_ID,
  scheduledAt: "2027-01-20T00:00:00.000Z",
  status: "proposed",
  clientFeedback: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  attendeesText: null,
  outcomeInternal: null,
  createdBy: null,
};

/** A page of records in the list envelope's `data`. */
export function pageOf(items: readonly unknown[]): { items: readonly unknown[]; nextCursor: null } {
  return { items, nextCursor: null };
}

/** Never answers: the request stays pending. */
export function pending(): Promise<Response> {
  return new Promise<Response>(() => {});
}

/** Answers one request; `"METHOD /path?query"` keys a handler. */
export type Handler = () => Response | Promise<Response>;

export interface SentRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

function urlOf(input: string | Request | URL): string {
  if (typeof input === "string") return input;
  return input instanceof Request ? input.url : input.href;
}

/** A fetch that routes by method, path and query, 404s anything else, and records every request. */
export function fakeApi(handlers: Readonly<Record<string, Handler>>) {
  const sent: SentRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    const path = urlOf(input).replace(TEST_API_BASE, "");
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    sent.push({ method, path, body });
    const handler = handlers[`${method} ${path}`];
    return handler ? handler() : failure("not_found", 404);
  };
  return { fetchImpl, sent };
}

/** Renders under the app's providers with a fake API answering `handlers`; returns what it was sent. */
export async function renderWithApi(
  ui: ReactElement,
  handlers: Readonly<Record<string, Handler>>,
): Promise<readonly SentRequest[]> {
  const api = fakeApi(handlers);
  await renderUnderApi(ui, api.fetchImpl);
  return api.sent;
}
