import type {
  AccountContactView,
  AccountDetailView,
  AccountView,
  MeResponse,
  PaymentFinanceView,
  PlanPublicView,
  SubscriptionView,
} from "@ampm/core";

import { failure, TEST_API_BASE } from "../../test/api";

export { failure, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for the staff client-accounts workspace: an account, a contact, a subscription and a plan
 * in the shapes the CRM endpoints return, plus a method-aware fetch that answers by path. Tests only.
 */

export const ACCOUNT_ID = "018f0000-0000-7000-8000-0000000d0001";
export const CONTACT_ID = "018f0000-0000-7000-8000-0000000d0002";
export const SUBSCRIPTION_ID = "018f0000-0000-7000-8000-0000000d0003";
export const PLAN_ID = "018f0000-0000-7000-8000-0000000d0004";
export const PAYMENT_ID = "018f0000-0000-7000-8000-0000000d0005";
export const FINANCE_USER_ID = "018f0000-0000-7000-8000-0000000d00fe";

/** A signed-in staff `/me` with the given roles — gates the Finance-only payment ledger. */
export function staffMeFixture(roles: MeResponse["roles"]): MeResponse {
  return {
    principal: {
      type: "staff",
      userId: FINANCE_USER_ID,
      name: "Farah Finance",
      email: "finance@example.com",
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

export function paymentFinanceViewFixture(
  overrides: Partial<PaymentFinanceView> = {},
): PaymentFinanceView {
  return {
    id: PAYMENT_ID,
    accountId: ACCOUNT_ID,
    direction: "inbound",
    purpose: "subscription",
    amount: { minor: 2_500_000, currency: "INR" },
    method: "bank_transfer",
    status: "succeeded",
    provider: null,
    providerRef: "UTR-9001",
    relatedType: "subscription",
    relatedId: SUBSCRIPTION_ID,
    paidAt: "2026-11-08T10:00:00Z",
    recordedBy: FINANCE_USER_ID,
    createdAt: "2026-11-08T09:00:00Z",
    ...overrides,
  };
}

export function accountViewFixture(overrides: Partial<AccountView> = {}): AccountView {
  return {
    id: ACCOUNT_ID,
    name: "The Sharma wedding",
    coupleNames: "Priya & Arjun",
    preferredLocations: "Udaipur, Jaipur",
    status: "active",
    isDemo: false,
    leadId: null,
    primaryContactUserId: null,
    internalNotes: null,
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-01T09:00:00Z",
    ...overrides,
  };
}

export function accountContactViewFixture(
  overrides: Partial<AccountContactView> = {},
): AccountContactView {
  return {
    id: CONTACT_ID,
    accountId: ACCOUNT_ID,
    name: "Priya Sharma",
    relation: "Bride",
    phone: "+91 98765 43210",
    email: "priya@example.com",
    isDecisionMaker: true,
    userId: null,
    createdAt: "2026-11-01T09:00:00Z",
    ...overrides,
  };
}

export function accountDetailViewFixture(
  overrides: Partial<AccountDetailView> = {},
): AccountDetailView {
  return { ...accountViewFixture(), contacts: [accountContactViewFixture()], ...overrides };
}

export function subscriptionViewFixture(
  overrides: Partial<SubscriptionView> = {},
): SubscriptionView {
  return {
    id: SUBSCRIPTION_ID,
    accountId: ACCOUNT_ID,
    planId: PLAN_ID,
    status: "pending_payment",
    startsAt: null,
    endsAt: null,
    trialEndsAt: null,
    autoRenew: true,
    activationSource: null,
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-01T09:00:00Z",
    ...overrides,
  };
}

export function planPublicViewFixture(overrides: Partial<PlanPublicView> = {}): PlanPublicView {
  return {
    id: PLAN_ID,
    planKey: "discovery",
    name: "Hotel discovery",
    planType: "hotel_discovery",
    billingType: "one_time",
    price: { minor: 2500000, currency: "INR" },
    termDays: 365,
    trialDays: null,
    modules: [],
    ...overrides,
  };
}

export type FetchFn = typeof fetch;
type Route = (init: RequestInit | undefined) => Response;

/** A fetch that answers by path (no base, no query), passing `init` so a route can branch on the method. */
export function routedFetch(routes: Readonly<Record<string, Route>>): FetchFn {
  return (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "").split("?")[0] ?? "";
    const route = routes[path];
    return Promise.resolve(route ? route(init) : failure("not_found", 404));
  };
}
