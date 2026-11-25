import type { HotelInfoRequestStatus } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { linkClosesAt, linkStateOf, requestViewOf, type FormRequest } from "./hotel-form-state.js";

/*
 * What a link opens to (D-189 §4 and §5): the state open answers, and the one every code and session route
 * re-checks: the mode (off is handled before, as a 404), the status with its expiry, the status-only window
 * after a merge, and a deleted hotel.
 */

const NOW = new Date("2026-11-25T10:00:00.000Z");
const LATER = new Date("2026-12-25T10:00:00.000Z");
const EARLIER = new Date("2026-11-20T10:00:00.000Z");

function request(overrides: Partial<FormRequest> = {}): FormRequest {
  return {
    id: "0192f1a0-0000-7000-8000-0000000000b1",
    isTest: false,
    status: "open",
    expiresAt: LATER,
    statusOnlyUntil: null,
    tokenGeneration: 1,
    displayLabel: "Monsoon refresh",
    staffNote: "Rooms first, please",
    hotelDeleted: false,
    ...overrides,
  };
}

describe("linkStateOf", () => {
  it("is not_active for no request at all", () => {
    expect(linkStateOf(null, "on", NOW)).toBe("not_active");
  });

  it("reads open and changes_requested as ready, submitted and in_review as locked", () => {
    const states = (["open", "changes_requested", "submitted", "in_review"] as const).map(
      (status) => linkStateOf(request({ status }), "on", NOW),
    );
    expect(states).toEqual(["ready", "ready", "locked", "locked"]);
  });

  it("is not_active once a live request's link has expired", () => {
    expect(linkStateOf(request({ expiresAt: NOW }), "on", NOW)).toBe("not_active");
    expect(linkStateOf(request({ status: "in_review", expiresAt: EARLIER }), "on", NOW)).toBe(
      "not_active",
    );
  });

  it("reads a merged request as status_only inside its window, whatever its expiry, and not_active after", () => {
    const merged = { status: "merged" as const, expiresAt: EARLIER };
    expect(linkStateOf(request({ ...merged, statusOnlyUntil: LATER }), "on", NOW)).toBe(
      "status_only",
    );
    expect(linkStateOf(request({ ...merged, statusOnlyUntil: NOW }), "on", NOW)).toBe("not_active");
    expect(linkStateOf(request({ ...merged, statusOnlyUntil: null }), "on", NOW)).toBe(
      "not_active",
    );
  });

  it("is not_active for a rejected or revoked request", () => {
    const closed: HotelInfoRequestStatus[] = ["rejected", "revoked"];
    for (const status of closed) {
      expect(linkStateOf(request({ status }), "on", NOW)).toBe("not_active");
    }
  });

  it("is not_active when the request's hotel was deleted", () => {
    expect(linkStateOf(request({ hotelDeleted: true }), "on", NOW)).toBe("not_active");
  });

  it("admits only test requests in test_only, and none when off", () => {
    expect(linkStateOf(request({ isTest: false }), "test_only", NOW)).toBe("not_active");
    expect(linkStateOf(request({ isTest: true }), "test_only", NOW)).toBe("ready");
    expect(linkStateOf(request({ isTest: true }), "off", NOW)).toBe("not_active");
  });
});

describe("linkClosesAt and requestViewOf", () => {
  it("closes a live link at its expiry and a merged one at the end of its window", () => {
    expect(linkClosesAt(request())).toEqual(LATER);
    const merged = request({ status: "merged", expiresAt: EARLIER, statusOnlyUntil: LATER });
    expect(linkClosesAt(merged)).toEqual(LATER);
  });

  it("shows a signed-in person the label, the note, the status and when the link closes", () => {
    expect(requestViewOf(request({ status: "in_review" }))).toEqual({
      displayLabel: "Monsoon refresh",
      staffNote: "Rooms first, please",
      status: "in_review",
      expiresAt: LATER.toISOString(),
    });
  });

  it("refuses to show a request no session may see", () => {
    expect(() => requestViewOf(request({ status: "revoked" }))).toThrow();
  });
});
