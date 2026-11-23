import type { HotelReach } from "@ampm/core";
import type { Entitlements } from "@ampm/policy";

import type { Principal } from "../src/policy/principal.types.js";

/*
 * Fabricated client and demo principals for service-level hotel discovery tests: the reach and entitlements
 * a signed-in client or demo prospect would carry, without the HTTP round trip of a subscription.
 */

/**
 * A discovery client's entitlements with one hotel reach.
 *
 * @example
 * fakeEntitlements("all_hotels", false); // an active subscriber
 */
export function fakeEntitlements(reach: HotelReach, readOnly: boolean): Entitlements {
  return {
    modules: ["hotel_discovery", "saved_hotels"],
    readOnlyModules: readOnly ? ["saved_hotels"] : [],
    hotelReach: [reach],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
    signInRefused: false,
  };
}

/**
 * A client or demo principal carrying those entitlements.
 *
 * @example
 * await hotels.get(fakePrincipal("client", fakeEntitlements("all_hotels", false)), hotelId);
 */
export function fakePrincipal(
  type: "client" | "demo",
  ent: Entitlements,
  userId = "00000000-0000-7000-8000-000000000000",
): Principal {
  return {
    type,
    userId,
    name: "T",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    entitlements: ent,
  };
}
