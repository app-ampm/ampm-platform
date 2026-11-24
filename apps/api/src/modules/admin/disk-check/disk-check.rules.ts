import type { StorageDiskGuard } from "@ampm/core";
import { z } from "zod";

/*
 * The disk check's rules (D-177), pure: the level the free space is at against configuration
 * `storage.disk_guard`, and whether a run alerts, sends the recovery notice or stays quiet, given what
 * earlier runs sent. The history comes from `job_runs`, so a restarted worker neither repeats an alert
 * nor forgets one.
 */

/** The job's name, on its definition and on every `job_runs` row it records. */
export const DISK_CHECK_JOB_NAME = "system.disk_check";

export const GIB = 1024 ** 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const diskLevel = z.enum(["ok", "low", "critical"]);
/** `ok` at or above the warning level, `low` below it, `critical` below the floor. */
export type DiskLevel = z.infer<typeof diskLevel>;

/** What one run measured and whether it notified anyone, recorded on its `job_runs` row. */
export const diskCheckOutcome = z.object({
  freeBytes: z.number().nonnegative(),
  totalBytes: z.number().nonnegative(),
  level: diskLevel,
  alerted: z.boolean(),
});
export type DiskCheckOutcome = z.infer<typeof diskCheckOutcome>;

/** A notice an earlier run sent: an alert at `low` or `critical`, or the recovery notice at `ok`. */
export interface PastNotice {
  readonly level: DiskLevel;
  readonly at: Date;
}

/** What earlier runs sent: the last notice of any kind, and when the last recovery notice went out. */
export interface NoticeHistory {
  readonly lastNotice: PastNotice | null;
  readonly lastRecoveryAt: Date | null;
}

export type DiskNotice = "alert" | "recovery" | "none";

const RANK: Readonly<Record<DiskLevel, number>> = { ok: 0, low: 1, critical: 2 };

/** The level `freeBytes` is at against the configured guard. */
export function levelOf(freeBytes: number, guard: StorageDiskGuard): DiskLevel {
  if (freeBytes < guard.floorGiB * GIB) return "critical";
  if (freeBytes < guard.warnGiB * GIB) return "low";
  return "ok";
}

/**
 * Whether this run notifies anyone. Below the warning level it alerts when the level is worse than what
 * the people last heard (a recovery notice counts as `ok`), or when that was 24 hours ago or more: an
 * alert on every move to a worse level, then at most one a day while the level stays below. At `ok` it
 * sends the recovery notice when the last notice was an alert, at most once a day. So space that flaps
 * across the warning level within a day sends an alert, the recovery notice and a second alert (low, ok,
 * low: after the recovery notice the drop is a move to a worse level, as D-177 has it), then nothing more
 * that day: the next return to `ok` stays quiet, which leaves the people with the more cautious news, and
 * the next drop to the level they were just alerted about waits until that alert is a day old.
 */
export function noticeFor(level: DiskLevel, history: NoticeHistory, now: Date): DiskNotice {
  const { lastNotice, lastRecoveryAt } = history;
  if (level === "ok") {
    const isOwed = lastNotice !== null && lastNotice.level !== "ok";
    return isOwed && !isWithinDay(lastRecoveryAt, now) ? "recovery" : "none";
  }
  if (lastNotice === null || RANK[level] > RANK[lastNotice.level]) return "alert";
  return isWithinDay(lastNotice.at, now) ? "none" : "alert";
}

function isWithinDay(at: Date | null, now: Date): boolean {
  return at !== null && now.getTime() - at.getTime() < DAY_MS;
}

/** GiB to one decimal, rounded down so the free space is never overstated: 8.96 GiB reads "8.9". */
export function gbText(bytes: number): string {
  return (Math.floor((bytes / GIB) * 10) / 10).toFixed(1);
}
