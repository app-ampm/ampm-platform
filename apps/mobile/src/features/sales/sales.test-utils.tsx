import type { LeadActivityView, LeadView } from "@ampm/core";

import { failure, TEST_API_BASE } from "../../test/api";

export { failure, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for the Sales screens: a lead in the exact shape `GET /crm/leads/:id` returns and a
 * fetch that answers by path; the render under the API and the envelopes are the app's (src/test/api).
 * Imported by tests only.
 */

export const LEAD_ID = "018f0000-0000-7000-8000-0000000001ad";
export const SECOND_LEAD_ID = "018f0000-0000-7000-8000-0000000001ae";
export const ACCOUNT_ID = "018f0000-0000-7000-8000-0000000002ac";
const STAFF_USER_ID = "018f0000-0000-7000-8000-00000000cafe";
const RECEIVED_AT = "2026-11-01T16:18:00Z";

/** A website lead asking for a demo: no owner yet, dates, destination and guests given. */
export function leadFixture(overrides: Partial<LeadView> = {}): LeadView {
  return {
    id: LEAD_ID,
    status: "new",
    name: "Rohit Malhotra",
    email: "rohit@example.com",
    phone: "+919911023344",
    contactPreference: null,
    tentativeDateFrom: "2027-12-12",
    tentativeDateTo: "2027-12-14",
    destinationId: null,
    destinationText: "Udaipur or Goa",
    guestEstimate: 250,
    requirements: "Lakeside venue for three functions.",
    source: { sourceKey: "instagram", name: "Instagram" },
    consentMarketing: false,
    consentAt: RECEIVED_AT,
    consentNoticeVersion: "2026-10",
    requestedDemo: true,
    ownerUserId: null,
    ownerName: null,
    convertedAccountId: null,
    convertedAt: null,
    closedReason: null,
    duplicateOfLeadId: null,
    nextFollowUpAt: null,
    createdAt: RECEIVED_AT,
    updatedAt: RECEIVED_AT,
    ...overrides,
  };
}

/** One logged activity on the lead's timeline. */
export function activityFixture(overrides: Partial<LeadActivityView> = {}): LeadActivityView {
  return {
    id: "018f0000-0000-7000-8000-0000000003ac",
    leadId: LEAD_ID,
    activityType: "call",
    occurredAt: RECEIVED_AT,
    userId: STAFF_USER_ID,
    summary: "Wedding in December 2027, about 250 guests.",
    questionnaireJson: null,
    nextFollowUpAt: null,
    createdAt: RECEIVED_AT,
    ...overrides,
  };
}

export type FetchFn = typeof fetch;
type Route = (init: RequestInit | undefined) => Response;

/** A fetch that answers by path (no base, no query); every other path is a 404, as for a stranger. */
export function routedFetch(routes: Readonly<Record<string, Route>>): FetchFn {
  return (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "").split("?")[0] ?? "";
    const route = routes[path];
    return Promise.resolve(route ? route(init) : failure("not_found", 404));
  };
}
