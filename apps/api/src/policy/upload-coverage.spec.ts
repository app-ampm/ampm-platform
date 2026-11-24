import { Body, Post, Req } from "@nestjs/common";
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
 * CI here, and so does a body read anywhere but a controller, where this test could not see it. In a
 * controller that imports the reader, a handler that takes the raw request (@Req()) needs them too,
 * since the request could reach the reader in a way the call-following below does not see (a helper
 * outside the class, a closure handed on).
 */
const reflector = new Reflector();
// The metadata key @UseInterceptors stores a handler's interceptors under; a stable framework constant.
const INTERCEPTORS_METADATA = "__interceptors__";
// A call of the reader, as written or as the test transform rewrites it (`(0, mod.readBoundedBody)(…)`).
const CALLS_READER = /\breadBoundedBody\)?\s*\(/;
// An import of the reader: the files that may call it.
const IMPORTS_READER = /import\s*\{[^}]*\breadBoundedBody\b[^}]*\}\s*from/;
// The metadata key Nest's route parameter decorators store a handler's parameters under, each keyed
// `<paramtype>:<index>`, and the paramtype of @Req() (RouteParamtypes.REQUEST): framework constants
// Nest does not export from its public entry point.
const ROUTE_ARGS_METADATA = "__routeArguments__";
const REQUEST_PARAMTYPE = "0";

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

/** A source file's path from `src`, however many `../` steps its glob named it with. */
const fromSrc = (file: string) => file.replace(/^(\.\.\/)+/, "");

/** The files that import the reader, from `src`. */
const READER_FILES = new Set(
  Object.entries(sources)
    .filter(([, text]) => IMPORTS_READER.test(text))
    .map(([file]) => fromSrc(file)),
);

/** Whether a handler takes the raw request (@Req() or @Request()), the way to its unread body. */
function takesRequest(cls: Ctor, handler: string): boolean {
  const params: unknown = Reflect.getMetadata(ROUTE_ARGS_METADATA, cls, handler);
  if (typeof params !== "object" || params === null) return false;
  return Object.keys(params).some((key) => key.split(":")[0] === REQUEST_PARAMTYPE);
}

/** Asserts a route takes an upload slot and counts against the upload limit, saying why if not. */
function expectUploadRoute(route: ControllerRoute, why: string): void {
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
    `${nameOf(route)} (${route.file}) ${why} without an upload slot; add @UploadRoute()`,
  ).toContain(UploadSlotInterceptor);
  expect(limit, `${nameOf(route)} ${why} outside the upload limit`).toEqual(UPLOADS);
}

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
      expectUploadRoute(route, "reads a body");
    });
  }
});

describe("upload coverage: a handler that takes the request where the reader is imported", () => {
  const takers = controllerRoutes().filter(
    (route) => READER_FILES.has(fromSrc(route.file)) && takesRequest(route.cls, route.handler),
  );

  it("finds them, every upload route among them", () => {
    expect(READER_FILES.size).toBeGreaterThan(0);
    expect(takers.map(nameOf)).toEqual(expect.arrayContaining(KNOWN_UPLOADS));
  });

  it("tells a handler that takes the request from one that does not", () => {
    class ProbeController {
      @Post("raw")
      raw(@Req() _req: unknown): void {}
      @Post("parsed")
      parsed(@Body() _body: unknown): void {}
    }
    expect(takesRequest(ProbeController, "raw")).toBe(true);
    expect(takesRequest(ProbeController, "parsed")).toBe(false);
  });

  for (const route of takers) {
    it(`${nameOf(route)} takes the request: it holds a slot and the upload limit`, () => {
      expectUploadRoute(route, "takes the request in a file that imports readBoundedBody");
    });
  }
});
