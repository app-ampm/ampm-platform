import { describe, expect, it } from "vitest";

import { extensionLimit, firstExpiryOf, nextExpiry } from "./hotel-info-request-expiry.js";

/*
 * Extending a request's link (D-188 §3 and §4): by whole days or to a new expiry, never past
 * maxExtensionDays after the first expiry, and never to a time already gone.
 */
const NOW = new Date("2026-12-01T10:00:00.000Z");
const CURRENT = new Date("2026-12-24T10:00:00.000Z");
const LIMIT = new Date("2027-02-22T10:00:00.000Z");

/** The error a call throws; fails the test when it throws none. */
function refusalOf(call: () => unknown): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  throw new Error("expected a refusal");
}

describe("extensionLimit and firstExpiryOf", () => {
  it("allows maxExtensionDays past the first expiry", () => {
    expect(extensionLimit(CURRENT, 60).toISOString()).toBe("2027-02-22T10:00:00.000Z");
    expect(extensionLimit(CURRENT, 0)).toEqual(CURRENT);
  });

  it("reads the first expiry from the earliest extension, else the current expiry", () => {
    expect(firstExpiryOf(null, CURRENT)).toEqual(CURRENT);
    expect(firstExpiryOf({ from: "2026-12-10T10:00:00.000Z" }, CURRENT).toISOString()).toBe(
      "2026-12-10T10:00:00.000Z",
    );
    // A detail that does not carry a time is not trusted: the current expiry stands.
    expect(firstExpiryOf({ from: 3 }, CURRENT)).toEqual(CURRENT);
    expect(firstExpiryOf("text", CURRENT)).toEqual(CURRENT);
  });
});

describe("nextExpiry", () => {
  it("adds days to the current expiry while it is ahead", () => {
    const next = nextExpiry({ extendDays: 14 }, { current: CURRENT, limit: LIMIT, now: NOW });
    expect(next?.toISOString()).toBe("2027-01-07T10:00:00.000Z");
  });

  it("adds days to now once the link has expired, so an extension reopens it", () => {
    const now = new Date("2027-01-02T10:00:00.000Z");
    const next = nextExpiry({ extendDays: 7 }, { current: CURRENT, limit: LIMIT, now });
    expect(next?.toISOString()).toBe("2027-01-09T10:00:00.000Z");
  });

  it("takes a new expiry later than the current one, up to the limit itself", () => {
    const next = nextExpiry(
      { expiresAt: "2027-02-22T10:00:00.000Z" },
      { current: CURRENT, limit: LIMIT, now: NOW },
    );
    expect(next).toEqual(LIMIT);
  });

  it("answers null when the update extends nothing", () => {
    expect(nextExpiry({}, { current: CURRENT, limit: LIMIT, now: NOW })).toBeNull();
  });

  it("refuses an extension past the limit, naming the field and the limit", () => {
    const window = { current: CURRENT, limit: LIMIT, now: NOW };
    // Already extended to 1 February: 30 more days would pass the limit of 22 February.
    const extended = { ...window, current: new Date("2027-02-01T10:00:00.000Z") };
    expect(nextExpiry({ extendDays: 60 }, window)).toEqual(LIMIT);
    expect(refusalOf(() => nextExpiry({ extendDays: 30 }, extended))).toMatchObject({
      code: "validation_failed",
      details: [
        { path: "extendDays", message: expect.stringContaining("2027-02-22T10:00:00.000Z") },
      ],
    });
    const late = { expiresAt: "2027-02-22T10:00:01.000Z" };
    expect(refusalOf(() => nextExpiry(late, window))).toMatchObject({
      details: [
        { path: "expiresAt", message: expect.stringContaining("2027-02-22T10:00:00.000Z") },
      ],
    });
  });

  it("refuses a new expiry that is not later than the current one, or already past", () => {
    for (const expiresAt of ["2026-12-24T10:00:00.000Z", "2026-12-20T10:00:00.000Z"]) {
      expect(() => nextExpiry({ expiresAt }, { current: CURRENT, limit: LIMIT, now: NOW })).toThrow(
        expect.objectContaining({ code: "validation_failed" }),
      );
    }
    const expired = new Date("2026-11-01T10:00:00.000Z");
    expect(() =>
      nextExpiry(
        { expiresAt: "2026-11-20T10:00:00.000Z" },
        { current: expired, limit: LIMIT, now: NOW },
      ),
    ).toThrow(expect.objectContaining({ code: "validation_failed" }));
  });
});
