import { describe, expect, it } from "vitest";

import { sessionRefusal } from "./hotel-form-session-checks.js";
import type { SessionRecord } from "./hotel-form-sessions.repository.js";
import type { FormRequest } from "./hotel-form-state.js";

/*
 * What HotelFormSessionGuard re-checks on every call (D-189 §5), coarsest first so the page goes straight
 * to HF-08 when the link itself is gone: the request (deleted, its hotel deleted, its status, expiry and
 * status-only window, the mode read fresh), the link's generation, the person, then the session itself
 * (ended, idle 2 hours, 12 hours in all).
 */

const NOW = new Date("2026-11-25T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const REQUEST: FormRequest = {
  id: "0192f1a0-0000-7000-8000-0000000000b1",
  isTest: true,
  status: "open",
  expiresAt: new Date("2026-12-25T10:00:00.000Z"),
  statusOnlyUntil: null,
  tokenGeneration: 2,
  displayLabel: null,
  staffNote: null,
  hotelDeleted: false,
};

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    challengeId: "0192f1a0-0000-7000-8000-0000000000c1",
    requestId: REQUEST.id,
    linkGeneration: 2,
    tokenHash: "a".repeat(64),
    startedAt: ago(HOUR),
    lastSeenAt: ago(5 * 60 * 1000),
    endedAt: null,
    person: {
      id: "0192f1a0-0000-7000-8000-0000000000d1",
      fullName: "Synthetic Person",
      designation: "General Manager",
      isGone: false,
    },
    request: REQUEST,
    ...overrides,
  };
}

describe("sessionRefusal", () => {
  it("passes a live session on a live link", () => {
    expect(sessionRefusal(session(), "on", NOW)).toBeNull();
    expect(sessionRefusal(session(), "test_only", NOW)).toBeNull();
  });

  it("refuses a deleted request, or one whose hotel was deleted, as not_active", () => {
    expect(sessionRefusal(session({ request: null }), "on", NOW)).toBe("not_active");
    const hotelGone = { ...REQUEST, hotelDeleted: true };
    expect(sessionRefusal(session({ request: hotelGone }), "on", NOW)).toBe("not_active");
  });

  it("refuses a request no longer open to the form: revoked, rejected, expired, or past its window", () => {
    const closed = (overrides: Partial<FormRequest>) =>
      sessionRefusal(session({ request: { ...REQUEST, ...overrides } }), "on", NOW);
    expect(closed({ status: "revoked" })).toBe("not_active");
    expect(closed({ status: "rejected" })).toBe("not_active");
    expect(closed({ expiresAt: NOW })).toBe("not_active");
    expect(closed({ status: "merged", statusOnlyUntil: ago(1) })).toBe("not_active");
  });

  it("passes a merged request inside its status-only window, and a locked one", () => {
    const merged = {
      ...REQUEST,
      status: "merged" as const,
      statusOnlyUntil: new Date(NOW.getTime() + HOUR),
    };
    expect(sessionRefusal(session({ request: merged }), "on", NOW)).toBeNull();
    const locked = { ...REQUEST, status: "in_review" as const };
    expect(sessionRefusal(session({ request: locked }), "on", NOW)).toBeNull();
  });

  it("reads the mode as given: test_only refuses a request that is not a test", () => {
    const real = { ...REQUEST, isTest: false };
    expect(sessionRefusal(session({ request: real }), "test_only", NOW)).toBe("not_active");
    expect(sessionRefusal(session({ request: real }), "on", NOW)).toBeNull();
  });

  it("refuses a session opened on an older link: AMPM reissued it", () => {
    expect(sessionRefusal(session({ linkGeneration: 1 }), "on", NOW)).toBe("link_changed");
  });

  it("refuses a person AMPM removed, or one deleted", () => {
    const gone = { ...session().person, isGone: true };
    expect(sessionRefusal(session({ person: gone }), "on", NOW)).toBe("person_removed");
  });

  it("refuses a session that ended", () => {
    expect(sessionRefusal(session({ endedAt: ago(1) }), "on", NOW)).toBe("session_ended");
  });

  it("refuses a session idle 2 hours, or 12 hours old", () => {
    expect(sessionRefusal(session({ lastSeenAt: ago(2 * HOUR) }), "on", NOW)).toBe(
      "session_expired",
    );
    const old = session({ startedAt: ago(12 * HOUR), lastSeenAt: ago(60_000) });
    expect(sessionRefusal(old, "on", NOW)).toBe("session_expired");
  });

  it("names the coarsest failure first", () => {
    const everything = session({
      request: { ...REQUEST, status: "revoked" },
      linkGeneration: 1,
      endedAt: ago(1),
    });
    expect(sessionRefusal(everything, "on", NOW)).toBe("not_active");
    expect(sessionRefusal(session({ linkGeneration: 1, endedAt: ago(1) }), "on", NOW)).toBe(
      "link_changed",
    );
  });
});
