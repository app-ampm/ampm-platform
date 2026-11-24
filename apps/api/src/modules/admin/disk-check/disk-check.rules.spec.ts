import { describe, expect, it } from "vitest";

import {
  GIB,
  gbText,
  levelOf,
  noticeFor,
  type DiskLevel,
  type NoticeHistory,
} from "./disk-check.rules.js";

/*
 * The disk check's rules (D-177): the level the free space is at, and whether a run alerts, sends the
 * recovery notice or stays quiet, given what earlier runs sent (read from job_runs).
 */

const GUARD = { floorGiB: 9, warnGiB: 12 };
const NOW = new Date("2026-11-25T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);
const NONE: NoticeHistory = { lastNotice: null, lastRecoveryAt: null };
const sent = (level: DiskLevel, hoursAgo: number, recoveredHoursAgo?: number): NoticeHistory => ({
  lastNotice: { level, at: ago(hoursAgo) },
  lastRecoveryAt: recoveredHoursAgo === undefined ? null : ago(recoveredHoursAgo),
});

describe("levelOf", () => {
  it("is ok at or above the warning level, low below it, critical below the floor", () => {
    expect(levelOf(30 * GIB, GUARD)).toBe("ok");
    expect(levelOf(12 * GIB, GUARD)).toBe("ok");
    expect(levelOf(12 * GIB - 1, GUARD)).toBe("low");
    expect(levelOf(9 * GIB, GUARD)).toBe("low");
    expect(levelOf(9 * GIB - 1, GUARD)).toBe("critical");
    expect(levelOf(0, GUARD)).toBe("critical");
  });

  it("follows the configured levels", () => {
    expect(levelOf(30 * GIB, { floorGiB: 20, warnGiB: 40 })).toBe("low");
    expect(levelOf(15 * GIB, { floorGiB: 20, warnGiB: 40 })).toBe("critical");
  });
});

describe("noticeFor", () => {
  it("stays quiet while there is room and nothing was ever sent", () => {
    expect(noticeFor("ok", NONE, NOW)).toBe("none");
  });

  it("alerts on the first move below the warning level or the floor", () => {
    expect(noticeFor("low", NONE, NOW)).toBe("alert");
    expect(noticeFor("critical", NONE, NOW)).toBe("alert");
  });

  it("alerts at most once every 24 hours while the level stays where it is", () => {
    expect(noticeFor("low", sent("low", 2), NOW)).toBe("none");
    expect(noticeFor("low", sent("low", 23.9), NOW)).toBe("none");
    expect(noticeFor("low", sent("low", 24), NOW)).toBe("alert");
    expect(noticeFor("critical", sent("critical", 30), NOW)).toBe("alert");
  });

  it("alerts at once on a move to a worse level", () => {
    expect(noticeFor("critical", sent("low", 0.25), NOW)).toBe("alert");
  });

  it("does not alert on an improvement that is still below the warning level, until 24 hours pass", () => {
    expect(noticeFor("low", sent("critical", 1), NOW)).toBe("none");
    expect(noticeFor("low", sent("critical", 24), NOW)).toBe("alert");
  });

  it("does not alert again for a level that flaps back within 24 hours of its alert", () => {
    // Critical 1 h ago, low since, critical again now: the people were told an hour ago.
    expect(noticeFor("critical", sent("critical", 1), NOW)).toBe("none");
  });

  it("sends one recovery notice on returning to ok after an alert", () => {
    expect(noticeFor("ok", sent("low", 3), NOW)).toBe("recovery");
    expect(noticeFor("ok", sent("critical", 50), NOW)).toBe("recovery");
    // The recovery notice is now the last notice, so the next run at ok sends nothing.
    expect(noticeFor("ok", sent("ok", 0.25, 0.25), NOW)).toBe("none");
  });

  it("alerts again after a recovery, as a move to a worse level", () => {
    expect(noticeFor("low", sent("ok", 1, 1), NOW)).toBe("alert");
    expect(noticeFor("critical", sent("ok", 1, 1), NOW)).toBe("alert");
  });

  it("sends at most one recovery notice a day while the space flaps around a level", () => {
    // Alerted 1 h ago, after a recovery notice 2 h ago: this return to ok stays quiet...
    expect(noticeFor("ok", sent("low", 1, 2), NOW)).toBe("none");
    // ...and the recovery is sent once the last one is a day old.
    expect(noticeFor("ok", sent("low", 1, 24), NOW)).toBe("recovery");
  });
});

describe("gbText", () => {
  it("gives GiB to one decimal, rounded down so the free space is never overstated", () => {
    expect(gbText(8.96 * GIB)).toBe("8.9");
    expect(gbText(8.4 * GIB)).toBe("8.4");
    expect(gbText(12 * GIB)).toBe("12.0");
    expect(gbText(0)).toBe("0.0");
  });
});
