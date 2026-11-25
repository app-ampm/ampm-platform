import { describe, expect, it } from "vitest";

import { BURN_LOOKBACK_MS, lockedUntil, type BurnedChallenge } from "./hotel-form-lock.js";

/*
 * The lock after burned codes (D-189 §2): after 3 challenges for one mobile and request each spend their
 * 5 tries within an hour, that mobile is locked on that request for an hour from the third burn. No new
 * code is issued while locked, so no burn happens then, and the three most recent burns decide.
 */

const NOW = new Date("2026-11-25T10:00:00.000Z");
const MINUTE = 60_000;
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * MINUTE);

/** A challenge created four minutes before it burned (its tries ran out inside its 5 minutes). */
const burnedAt = (minutesAgo: number): BurnedChallenge => ({
  createdAt: ago(minutesAgo + 4),
  retiredAt: ago(minutesAgo),
});

describe("lockedUntil", () => {
  it("does not lock on fewer than three burns", () => {
    expect(lockedUntil([], NOW)).toBeNull();
    expect(lockedUntil([burnedAt(1), burnedAt(2)], NOW)).toBeNull();
  });

  it("locks for an hour from the third burn within an hour", () => {
    const until = lockedUntil([burnedAt(5), burnedAt(20), burnedAt(40)], NOW);
    expect(until).toEqual(new Date(ago(5).getTime() + 60 * MINUTE));
  });

  it("reads the burns in any order", () => {
    const until = lockedUntil([burnedAt(40), burnedAt(5), burnedAt(20)], NOW);
    expect(until).toEqual(new Date(ago(5).getTime() + 60 * MINUTE));
  });

  it("does not lock when the three burns span more than an hour", () => {
    expect(lockedUntil([burnedAt(5), burnedAt(30), burnedAt(66)], NOW)).toBeNull();
  });

  it("ends the lock an hour after the third burn, not when the first leaves the hour", () => {
    // Burns 70, 80 and 100 minutes ago: the lock from the burn 70 minutes ago ended 10 minutes ago.
    expect(lockedUntil([burnedAt(70), burnedAt(80), burnedAt(100)], NOW)).toBeNull();
    // Burns 59, 65 and 90 minutes ago span 31 minutes: locked for one more minute.
    const until = lockedUntil([burnedAt(59), burnedAt(65), burnedAt(90)], NOW);
    expect(until).toEqual(new Date(NOW.getTime() + MINUTE));
  });

  it("judges by the three most recent burns", () => {
    // After a lock that ended, one new burn: the latest three span more than an hour.
    const burns = [burnedAt(1), burnedAt(70), burnedAt(80), burnedAt(100)];
    expect(lockedUntil(burns, NOW)).toBeNull();
  });

  it("reads a burn not yet retired by its creation", () => {
    const unretired: BurnedChallenge = { createdAt: ago(3), retiredAt: null };
    const until = lockedUntil([unretired, burnedAt(10), burnedAt(20)], NOW);
    expect(until).toEqual(new Date(ago(3).getTime() + 60 * MINUTE));
  });

  it("asks the repository for two hours of burns: a lock can start an hour before an hour-long lock", () => {
    expect(BURN_LOOKBACK_MS).toBe(2 * 60 * MINUTE);
  });
});
