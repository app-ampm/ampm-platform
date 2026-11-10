import type { ReactNode } from "react";

import type { MeResponse, PlanPublicView } from "@ampm/core";

import { failure, jsonResponse, renderWithApi } from "../../test/api";
import { PortalScreen } from "./portal-screen";

export { failure, jsonResponse } from "../../test/api";

/*
 * Test fixtures for the portal screen tests: synthetic principals and the seeded discovery plan, a
 * fetch that answers by method and path, and the portal rendered under the API (src/test/api).
 */

const NO_ENTITLEMENTS: MeResponse["entitlements"] = {
  modules: [],
  readOnlyModules: [],
  hotelReach: [],
  financeReach: [],
  requestTypes: { wedding: [], account: [] },
};

/** A signed-in client before any purchase: hotel discovery is locked. */
export const ME_LOCKED: MeResponse = {
  principal: {
    type: "client",
    userId: "018f0000-0000-7000-8000-0000000000c1",
    name: "Ananya Sharma",
    email: "ananya@example.com",
    phone: null,
    status: "active",
    lastLoginAt: null,
  },
  roles: [],
  memberships: [],
  entitlements: NO_ENTITLEMENTS,
  isDemo: false,
};

/** The same client once the discovery subscription is active: every hotel, plus hotel assistance. */
export const ME_SUBSCRIBER: MeResponse = {
  ...ME_LOCKED,
  entitlements: {
    ...NO_ENTITLEMENTS,
    modules: ["hotel_discovery", "saved_hotels", "hotel_assistance"],
    hotelReach: ["all_hotels"],
  },
};

/** A demo principal: hotel discovery over the demo set only, so the page stays on activation. */
export const ME_DEMO: MeResponse = {
  ...ME_LOCKED,
  principal: { ...ME_LOCKED.principal, type: "demo", name: "Priya Prospect" },
  entitlements: { ...NO_ENTITLEMENTS, modules: ["hotel_discovery"], hotelReach: ["demo_hotels"] },
  isDemo: true,
};

/** The seeded v1 plan: Hotel Discovery, Rs 50,000 one-time for 30 days. */
export const PLAN: PlanPublicView = {
  id: "018f0000-0000-7000-8000-0000000000a1",
  planKey: "discovery",
  name: "Hotel Discovery",
  planType: "hotel_discovery",
  billingType: "one_time",
  price: { minor: 5_000_000, currency: "INR" },
  termDays: 30,
  trialDays: null,
  modules: [
    { moduleKey: "hotel_discovery", accessLevel: "full" },
    { moduleKey: "hotel_assistance", accessLevel: "full" },
  ],
};

export const SUBSCRIPTION_ID = "018f0000-0000-7000-8000-0000000000b2";

/** Answers one request: a response, or a rejection for a network failure. */
export type Handler = () => Response | Promise<Response>;

function pathOf(input: string | URL | Request): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(url).pathname;
}

/** A fetch that routes `"METHOD /path"` to its handler and answers anything else with a 404. */
export function apiFetch(handlers: Readonly<Record<string, Handler>>): typeof fetch {
  return async (input, init) => {
    const handler = handlers[`${init?.method ?? "GET"} ${pathOf(input)}`];
    return handler ? handler() : failure("not_found", 404);
  };
}

/** Never answers: the request stays pending. */
export const pending: Handler = () => new Promise<Response>(() => {});

/** The client's own data: `/me`, the plan catalogue, and the home's empty shortlist + destinations (B16). */
export function portalApi(me: MeResponse, extra: Readonly<Record<string, Handler>> = {}) {
  return apiFetch({
    "GET /me": () => jsonResponse({ data: me }),
    "GET /crm/plans": () => jsonResponse({ data: { items: [PLAN] } }),
    "GET /hotels/saved": () => jsonResponse({ data: { items: [], nextCursor: null } }),
    "GET /hotels/destinations": () => jsonResponse({ data: { items: [] } }),
    ...extra,
  });
}

/** Renders the portal under the app's providers, with the fake API and the tab bar given. */
export async function renderPortal(fetchImpl: typeof fetch, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<PortalScreen tabBar={tabBar} />, fetchImpl);
}
