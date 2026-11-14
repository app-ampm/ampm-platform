import type { LeadActivityView, LeadFunnelView, LeadView, MeResponse } from "@ampm/core";

import { failure, ok, TEST_API_BASE } from "../../test/api";

export { failure, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for the Sales screens: a lead in the exact shape `GET /crm/leads/:id` returns and a
 * fetch that answers by path; the render under the API and the envelopes are the app's (src/test/api).
 * Imported by tests only.
 */

export const LEAD_ID = "018f0000-0000-7000-8000-0000000001ad";
export const SECOND_LEAD_ID = "018f0000-0000-7000-8000-0000000001ae";
export const ACCOUNT_ID = "018f0000-0000-7000-8000-0000000002ac";
export const STAFF_USER_ID = "018f0000-0000-7000-8000-00000000cafe";
const RECEIVED_AT = "2026-11-01T16:18:00Z";

/** The signed-in staff principal (`/me`); defaults to a Sales rep whose id owns leads assigned "to me". */
export function staffMeFixture(roles: MeResponse["roles"] = ["SM"]): MeResponse {
  return {
    principal: {
      type: "staff",
      userId: STAFF_USER_ID,
      name: "Sameer Sales",
      email: "sales@example.com",
      phone: null,
      status: "active",
      lastLoginAt: null,
    },
    roles,
    memberships: [],
    entitlements: {
      modules: [],
      readOnlyModules: [],
      hotelReach: [],
      financeReach: [],
      requestTypes: { wedding: [], account: [] },
    },
    isDemo: false,
  };
}

/** A lead funnel report: counts by stage and by source (TW-83). */
export function leadFunnelViewFixture(overrides: Partial<LeadFunnelView> = {}): LeadFunnelView {
  return {
    total: 12,
    byStatus: [
      { status: "new", count: 6 },
      { status: "contacted", count: 3 },
      { status: "converted", count: 2 },
      { status: "closed", count: 1 },
    ],
    bySource: [
      { sourceKey: "instagram", name: "Instagram", count: 7 },
      { sourceKey: "referral", name: "Referral", count: 5 },
    ],
    ...overrides,
  };
}

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

/** The paths a lead's detail reads: the lead, its (empty) timeline and `/me`; `routes` add or override. */
export function leadDetailFetch(
  lead: LeadView,
  routes: Readonly<Record<string, Route>> = {},
): FetchFn {
  const leadPath = `/crm/leads/${lead.id}`;
  return routedFetch({
    [leadPath]: () => ok(lead),
    [`${leadPath}/activities`]: () => ok({ items: [] }),
    "/me": () => ok(staffMeFixture()),
    ...routes,
  });
}
