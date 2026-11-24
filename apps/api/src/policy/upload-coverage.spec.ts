import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { RATE_LIMIT, type RateLimitOptions } from "../common/rate-limit/rate-limit.decorator.js";
import { UPLOADS } from "../common/rate-limit/route-limits.js";
import { UploadSlotInterceptor } from "../common/upload-slot/upload-slot.interceptor.js";
import {
  controllerRoutes,
  handlerOf,
  type ControllerRoute,
  type Ctor,
} from "./testing/controller-routes.js";

/*
 * Architecture test (D-187 §1). A route that reads a file reads it in its handler, through
 * readBoundedBody, after the guards; every such route takes an upload slot and counts against the
 * upload rate limit, which fails closed (@UploadRoute). A route that reads a body without them fails
 * CI here, and so does a body read anywhere but a controller, where this test could not see it.
 */
const reflector = new Reflector();
// The metadata key @UseInterceptors stores a handler's interceptors under; a stable framework constant.
const INTERCEPTORS_METADATA = "__interceptors__";
// A call of the reader, as written or as the test transform rewrites it (`(0, mod.readBoundedBody)(…)`).
const CALLS_READER = /\breadBoundedBody\)?\s*\(/;
// An import of the reader: the files that may call it.
const IMPORTS_READER = /import\s*\{[^}]*\breadBoundedBody\b[^}]*\}\s*from/;

/** Every source file of the API but the tests and the generated client, as text. */
const sources = import.meta.glob<string>(["../**/*.ts", "!../**/*.spec.ts", "!../generated/**"], {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The upload routes as they stand: the detector below must find at least these. */
const KNOWN_UPLOADS = [
  "MediaController.upload",
  "BookingMilestonesController.attachContract",
  "ServiceAgreementsController.markSignedOffline",
  "HotelReferencesController.attachConsent",
  "HotelDocumentsController.upload",
  "HotelImportController.importHotels",
  "HotelImportController.importRooms",
  "HotelImportController.importVenues",
  "HotelImportController.importRates",
];

const nameOf = (route: ControllerRoute) => `${route.cls.name}.${route.handler}`;

/** Whether a method calls the reader, itself or through another method of its class. */
function readsBody(cls: Ctor, method: string, seen = new Set<string>()): boolean {
  if (seen.has(method)) return false;
  seen.add(method);
  const fn = (cls.prototype as Record<string, unknown>)[method];
  if (typeof fn !== "function") return false;
  const source = String(fn);
  if (CALLS_READER.test(source)) return true;
  return [...source.matchAll(/this\.(\w+)\(/g)].some(([, called]) =>
    called === undefined ? false : readsBody(cls, called, seen),
  );
}

describe("upload coverage: every route that reads a body holds a slot and the upload limit", () => {
  const uploads = controllerRoutes().filter((route) => readsBody(route.cls, route.handler));

  it("finds the upload routes", () => {
    expect(uploads.map(nameOf)).toEqual(expect.arrayContaining(KNOWN_UPLOADS));
  });

  it("reads a body only in a controller, where the routes are checked", () => {
    const readers = Object.entries(sources)
      .filter(([file, text]) => IMPORTS_READER.test(text) && !file.endsWith(".controller.ts"))
      .map(([file]) => file);
    expect(readers).toEqual([]);
  });

  for (const route of uploads) {
    it(`${nameOf(route)} takes an upload slot and counts against the upload limit`, () => {
      const interceptors = reflector.get<unknown[] | undefined>(
        INTERCEPTORS_METADATA,
        handlerOf(route),
      );
      const limit = reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT, [
        handlerOf(route),
        route.cls,
      ]);
      expect(
        interceptors ?? [],
        `${nameOf(route)} (${route.file}) reads a body without an upload slot; add @UploadRoute()`,
      ).toContain(UploadSlotInterceptor);
      expect(limit, `${nameOf(route)} reads a body outside the upload limit`).toEqual(UPLOADS);
    });
  }
});
