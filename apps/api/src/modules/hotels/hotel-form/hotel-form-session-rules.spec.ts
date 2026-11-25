import { createHash } from "node:crypto";

import { hotelFormSessionToken } from "@ampm/core";
import { describe, expect, it } from "vitest";

import {
  hashSessionToken,
  isSessionExpired,
  mintSessionToken,
  needsTouch,
  SESSION_IDLE_MS,
  SESSION_TOTAL_MS,
  sessionsToEnd,
  sessionTokenFrom,
} from "./hotel-form-session-rules.js";

/*
 * A hotel form session's lifetime (D-189 §5): an hfs_ token stored as its SHA-256, 2 hours idle or 12 in
 * all, at most 3 live per person (a fourth ends the oldest), and last_seen written at most once a minute.
 */

const NOW = new Date("2026-11-25T10:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("the session token", () => {
  it("is hfs_ and 32 random bytes, stored only as its SHA-256", () => {
    const { token, hash } = mintSessionToken();
    expect(hotelFormSessionToken.safeParse(token).success).toBe(true);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashSessionToken(token)).toBe(hash);
    expect(mintSessionToken().token).not.toBe(token);
  });

  it("is read from a Bearer header, and nothing else is", () => {
    const { token } = mintSessionToken();
    expect(sessionTokenFrom(`Bearer ${token}`)).toBe(token);
    expect(sessionTokenFrom(`bearer ${token}`)).toBe(token);
    expect(sessionTokenFrom(undefined)).toBeNull();
    expect(sessionTokenFrom(token)).toBeNull();
    expect(sessionTokenFrom(`Basic ${token}`)).toBeNull();
    expect(sessionTokenFrom(`Bearer hfl_${"a".repeat(43)}`)).toBeNull();
    expect(sessionTokenFrom(`Bearer ${token} extra`)).toBeNull();
  });
});

describe("isSessionExpired", () => {
  it("expires after 2 hours idle, counted from the last sight or the start", () => {
    expect(SESSION_IDLE_MS).toBe(2 * HOUR);
    expect(isSessionExpired({ startedAt: ago(HOUR), lastSeenAt: ago(HOUR) }, NOW)).toBe(false);
    expect(isSessionExpired({ startedAt: ago(3 * HOUR), lastSeenAt: ago(2 * HOUR) }, NOW)).toBe(
      true,
    );
    expect(isSessionExpired({ startedAt: ago(2 * HOUR), lastSeenAt: null }, NOW)).toBe(true);
    expect(isSessionExpired({ startedAt: ago(2 * HOUR - 1), lastSeenAt: null }, NOW)).toBe(false);
  });

  it("expires 12 hours after it started, however busy", () => {
    expect(SESSION_TOTAL_MS).toBe(12 * HOUR);
    expect(isSessionExpired({ startedAt: ago(12 * HOUR), lastSeenAt: ago(MINUTE) }, NOW)).toBe(
      true,
    );
    expect(isSessionExpired({ startedAt: ago(12 * HOUR - 1), lastSeenAt: ago(MINUTE) }, NOW)).toBe(
      false,
    );
  });
});

describe("sessionsToEnd", () => {
  const session = (id: string, startedHoursAgo: number) => ({
    id,
    startedAt: ago(startedHoursAgo * HOUR),
    lastSeenAt: ago(startedHoursAgo * HOUR),
  });

  it("keeps the three newest live sessions and ends the older live ones", () => {
    const sessions = [session("d", 0), session("c", 0.25), session("b", 0.5), session("a", 1)];
    expect(sessionsToEnd(sessions, NOW)).toEqual(["a"]);
  });

  it("does not count or end expired sessions", () => {
    const sessions = [session("d", 0), session("c", 0.5), session("expired", 3), session("b", 1)];
    expect(sessionsToEnd(sessions, NOW)).toEqual([]);
  });

  it("reads the sessions in any order", () => {
    const sessions = [session("a", 1), session("c", 0.25), session("e", 0), session("b", 0.5)];
    expect(sessionsToEnd(sessions, NOW)).toEqual(["a"]);
  });
});

describe("needsTouch", () => {
  it("writes last_seen at most once a minute", () => {
    expect(needsTouch(ago(30_000), NOW)).toBe(false);
    expect(needsTouch(ago(MINUTE), NOW)).toBe(true);
    expect(needsTouch(ago(5 * MINUTE), NOW)).toBe(true);
  });
});
