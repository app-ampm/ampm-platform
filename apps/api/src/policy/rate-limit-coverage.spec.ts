import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import {
  RATE_LIMIT,
  RATE_LIMIT_EXEMPT,
  type RateLimitOptions,
} from "../common/rate-limit/rate-limit.decorator.js";
import { IS_PUBLIC, PERMISSION } from "./decorators.js";
import { controllerRoutes, handlerOf, type ControllerRoute } from "./testing/controller-routes.js";

/*
 * Architecture test (security.md "Abuse", D-149). Every route a non-staff caller can reach carries a
 * @RateLimit or a reasoned @RateLimitExempt: the public routes, and those with no permission key, which
 * clients, demo prospects and anonymous callers reach (only staff hold permission keys, so a keyed route
 * refuses everyone else before its handler). A new public or client route without one fails CI here.
 * And the routes that try a credential, or spend money or storage, fail closed: none of them runs
 * uncounted while the limiter's store is down.
 */
const reflector = new Reflector();
// The metadata key @Controller stores the controller's path under; a stable framework constant.
const PATH_METADATA = "path";

/** The routes beyond sign-in that must fail closed: each spends money, storage or Sales' attention. */
const COSTLY = [
  "PortalController.subscribe", // creates a gateway order
  "EnquiriesClientController.request", // notifies Sales
  "LeadsController.submit", // a bot check, a lead and an email to Sales
  "MediaController.upload", // reads, scans and stores up to 25 MiB
  // Each document upload reads, scans and stores up to 20 MiB.
  "BookingMilestonesController.attachContract",
  "ServiceAgreementsController.markSignedOffline",
  "HotelReferencesController.attachConsent",
  // Each import preview reads up to 5 MiB and stores its plan; each import writes up to 2,000 rows.
  "HotelImportController.importHotels",
  "HotelImportController.importRooms",
  "HotelImportController.importVenues",
  "HotelImportController.importRates",
  "HotelImportController.applyHotels",
  "HotelImportController.applyRooms",
  "HotelImportController.applyVenues",
  "HotelImportController.applyRates",
];

/** Metadata on the handler, else on its controller: the order the guards read it in. */
function metadata<T>(route: ControllerRoute, key: string): T | undefined {
  return reflector.getAllAndOverride<T | undefined>(key, [handlerOf(route), route.cls]);
}

const nameOf = (route: ControllerRoute) => `${route.cls.name}.${route.handler}`;
const isPublic = (route: ControllerRoute) => metadata<boolean>(route, IS_PUBLIC) === true;
const reachableWithoutStaffKey = (route: ControllerRoute) =>
  isPublic(route) || metadata<unknown>(route, PERMISSION) === undefined;
const isSignIn = (route: ControllerRoute) =>
  isPublic(route) && reflector.get<string | undefined>(PATH_METADATA, route.cls) === "auth";

describe("rate-limit coverage: every route a non-staff caller reaches is limited (D-149)", () => {
  const routes = controllerRoutes();
  const open = routes.filter(reachableWithoutStaffKey);

  it("discovers public and client routes to check", () => {
    expect(open.length).toBeGreaterThan(10);
  });

  for (const route of open) {
    it(`${nameOf(route)} declares @RateLimit or @RateLimitExempt`, () => {
      const limit = metadata<RateLimitOptions>(route, RATE_LIMIT);
      const exempt = metadata<string>(route, RATE_LIMIT_EXEMPT);
      expect(
        limit !== undefined || Boolean(exempt?.trim()),
        `${nameOf(route)} (${route.file}) can be reached without a staff permission but has no ` +
          `rate limit; add @RateLimit({ name, limit, windowMs, failClosed }) or a reasoned @RateLimitExempt`,
      ).toBe(true);
    });
  }

  for (const route of routes.filter(isSignIn)) {
    it(`${nameOf(route)} fails closed: no credential is tried uncounted`, () => {
      expect(metadata<RateLimitOptions>(route, RATE_LIMIT)?.failClosed).toBe(true);
    });
  }

  for (const name of COSTLY) {
    it(`${name} is limited and fails closed`, () => {
      const route = routes.find((candidate) => nameOf(candidate) === name);
      expect(route, `${name} no longer exists; update COSTLY`).toBeDefined();
      expect(route && metadata<RateLimitOptions>(route, RATE_LIMIT)?.failClosed).toBe(true);
    });
  }
});
