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

/**
 * The routes beyond sign-in that must fail closed: each spends money, storage, Sales' attention or email
 * to someone outside AMPM.
 */
const COSTLY = [
  "PortalController.subscribe", // creates a gateway order
  "EnquiriesClientController.request", // notifies Sales
  "LeadsController.submit", // a bot check, a lead and an email to Sales
  "MediaController.upload", // reads, scans and stores up to 25 MiB
  // Each document upload reads, scans and stores up to 20 MiB.
  "BookingMilestonesController.attachContract",
  "ServiceAgreementsController.markSignedOffline",
  "HotelReferencesController.attachConsent",
  // Each hotel document reads, checks, scans and stores up to 25 MiB (D-187 §6).
  "HotelDocumentsController.upload",
  // Each import preview reads up to 5 MiB and stores its plan; each import writes up to 2,000 rows.
  "HotelImportController.importHotels",
  "HotelImportController.importRooms",
  "HotelImportController.importVenues",
  "HotelImportController.importRates",
  "HotelImportController.applyHotels",
  "HotelImportController.applyRooms",
  "HotelImportController.applyVenues",
  "HotelImportController.applyRates",
  // Each issues a hotel information request's link and can email it to an address outside AMPM (D-188 §5).
  "HotelInfoRequestsController.create",
  "HotelInfoRequestsController.reissue",
  // A hotel form code request costs a bot check, a challenge and, in SMS mode, a text message; a verify
  // spends one of the challenge's tries (D-189 §3 and §4).
  "HotelFormController.requestCode",
  "HotelFormController.verifyCode",
  // A section's save stores up to 96 KB; a submit costs a bot check, a revision and staff email; a
  // correction a bot check and staff email; a withdrawal a Super Admin's review (D-190 §3).
  "HotelFormController.saveSection",
  "HotelFormController.submit",
  "HotelFormController.requestCorrection",
  "HotelFormController.withdrawConsent",
];

/** The hotel form's public routes (D-189 §4, D-190 §3), whose every limit fails closed but sign-out's. */
const HOTEL_FORM_ROUTES = [
  "open",
  "requestCode",
  "verifyCode",
  "getMe",
  "updateMe",
  "signOut",
  "getDraft",
  "saveSection",
  "submit",
  "requestCorrection",
  "withdrawConsent",
];
/** The one hotel form route that fails open: D-149 keeps sign-out open. */
const HOTEL_FORM_FAILS_OPEN = "signOut";

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

  const form = routes.filter((route) => route.cls.name === "HotelFormController");

  it("discovers the hotel form's public routes", () => {
    expect(form.map((route) => route.handler).sort()).toEqual([...HOTEL_FORM_ROUTES].sort());
  });

  for (const route of form) {
    const failsOpen = route.handler === HOTEL_FORM_FAILS_OPEN;
    it(`${nameOf(route)} ${failsOpen ? "fails open (sign-out, D-149)" : "fails closed"}`, () => {
      expect(isPublic(route)).toBe(true);
      expect(metadata<RateLimitOptions>(route, RATE_LIMIT)?.failClosed).toBe(!failsOpen);
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
