import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { Env } from "../../../env.js";
import type { JobQueue } from "../../../jobs/job-queue.js";
import type { ConfigService } from "../config/config.service.js";
import type {
  NotificationService,
  QueueNotification,
  QueueResult,
} from "../notification/notification.service.js";
import {
  HOTEL_TEAM_ALERT_ROLES,
  type StaffAlertRecipients,
} from "../notification/staff-alert-recipients.js";
import type { DiskCheckRepository } from "./disk-check.repository.js";
import { GIB, type DiskLevel, type NoticeHistory } from "./disk-check.rules.js";
import { DISK_CHECK_CRON, DiskCheckService, diskCheckJob } from "./disk-check.service.js";
import type { DiskSpaceProbe } from "./disk-space.probe.js";

/*
 * The worker's disk check (D-177) with fakes: it measures the storage directory, records the run, and
 * alerts the active Super Admin and Hotel team staff in-app and by email, deduplicated by what earlier
 * runs sent. The database side (the history query, the recipients by role, the notification rows) is in
 * test/disk-check.e2e-spec.ts.
 */

const NOW = new Date("2026-11-25T10:15:00.000Z");
const HOUR = 60 * 60 * 1000;
const NONE: NoticeHistory = { lastNotice: null, lastRecoveryAt: null };
const alertedAt = (level: DiskLevel, hoursAgo: number): NoticeHistory => ({
  lastNotice: { level, at: new Date(NOW.getTime() - hoursAgo * HOUR) },
  lastRecoveryAt: null,
});

interface FakeOptions {
  readonly worker?: boolean;
  /** Free GiB; absent makes the measurement fail, as statfs on a missing directory does. */
  readonly freeGiB?: number;
  readonly history?: NoticeHistory;
  readonly recipients?: readonly string[];
  readonly failNoticeFor?: string;
}

function build(options: FakeOptions = {}) {
  const register = vi.fn();
  const scheduleRepeatable = vi.fn(async () => undefined);
  const start = vi.fn(async (_now: Date) => "run-1");
  const succeed = vi.fn(async () => undefined);
  const fail = vi.fn(async () => undefined);
  const history = vi.fn(async () => options.history ?? NONE);
  const recipientIds = vi.fn(async (_roles: readonly string[]) => [
    ...(options.recipients ?? ["sa-1", "ht-1"]),
  ]);
  const measure = vi.fn(async (_dir: string) => {
    if (options.freeGiB === undefined) throw new Error("ENOENT: no such file or directory, statfs");
    return { freeBytes: options.freeGiB * GIB, totalBytes: 193 * GIB };
  });
  const get = vi.fn(async () => ({ floorGiB: 9, warnGiB: 12 }));
  const queue = vi.fn(async (input: QueueNotification): Promise<QueueResult> => {
    if (input.recipientId === options.failNoticeFor) throw new Error("connection reset");
    return { suppressed: false, notificationId: `n-${input.recipientId}-${input.channel}` };
  });
  const { logger, entries } = createMemoryLogger("debug");
  const service = new DiskCheckService(
    { register, scheduleRepeatable } as unknown as JobQueue,
    { start, succeed, fail, history } as unknown as DiskCheckRepository,
    { get } as unknown as ConfigService,
    { queue } as unknown as NotificationService,
    { ids: recipientIds } as unknown as StaffAlertRecipients,
    { measure } as unknown as DiskSpaceProbe,
    logger as unknown as AppLogger,
    { JOB_WORKER: options.worker ?? false, STORAGE_LOCAL_DIR: "/data/storage" } as unknown as Env,
  );
  return {
    service,
    register,
    scheduleRepeatable,
    start,
    succeed,
    fail,
    measure,
    queue,
    recipientIds,
    entries,
  };
}

describe("DiskCheckService", () => {
  it("is registered and scheduled every 15 minutes in the worker only", async () => {
    const api = build({ freeGiB: 30 });
    await api.service.onModuleInit();
    expect(api.register).not.toHaveBeenCalled();
    expect(api.scheduleRepeatable).not.toHaveBeenCalled();
    const worker = build({ worker: true, freeGiB: 30 });
    await worker.service.onModuleInit();
    expect(worker.register).toHaveBeenCalledWith(diskCheckJob, expect.any(Function));
    expect(worker.scheduleRepeatable).toHaveBeenCalledWith(diskCheckJob, DISK_CHECK_CRON, {});
    expect(DISK_CHECK_CRON).toBe("*/15 * * * *");
    expect(diskCheckJob.name).toBe("system.disk_check");
  });

  it("measures the storage directory and records the outcome, alerting no one while there is room", async () => {
    const check = build({ freeGiB: 30 });
    const outcome = await check.service.run(NOW);
    expect(check.measure).toHaveBeenCalledWith("/data/storage");
    expect(check.start).toHaveBeenCalledWith(NOW);
    const expected = { freeBytes: 30 * GIB, totalBytes: 193 * GIB, level: "ok", alerted: false };
    expect(outcome).toEqual(expected);
    expect(check.succeed).toHaveBeenCalledWith("run-1", expected);
    expect(check.queue).not.toHaveBeenCalled();
    expect(check.entries).toEqual([]);
  });

  it("alerts each recipient in-app and by email below the warning level, with the GB figures", async () => {
    const check = build({ freeGiB: 11.25 });
    expect(await check.service.run(NOW)).toMatchObject({ level: "low", alerted: true });
    expect(check.queue).toHaveBeenCalledTimes(4);
    for (const recipientId of ["sa-1", "ht-1"]) {
      for (const channel of ["in_app", "email"]) {
        expect(check.queue).toHaveBeenCalledWith({
          recipientType: "user",
          recipientId,
          channel,
          eventType: "system.disk_space",
          templateKey: "system.disk_low",
          entityType: "job_run",
          entityId: "run-1",
          variables: { freeGb: "11.2", floorGb: "9", warnGb: "12" },
        });
      }
    }
    expect(check.entries).toContainEqual(
      expect.objectContaining({ event: "system.disk_check.alerted", level: "warn" }),
    );
    // The recipients come from the query every staff alert shares (D-190 §4).
    expect(check.recipientIds).toHaveBeenCalledWith(HOTEL_TEAM_ALERT_ROLES);
  });

  it("calls it critical below the floor", async () => {
    const check = build({ freeGiB: 8.4, history: alertedAt("low", 1) });
    expect(await check.service.run(NOW)).toMatchObject({ level: "critical", alerted: true });
    expect(check.queue).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "system.disk_critical", channel: "email" }),
    );
  });

  it("does not alert again within 24 hours of the last alert, read from earlier runs", async () => {
    const check = build({ freeGiB: 11, history: alertedAt("low", 2) });
    expect(await check.service.run(NOW)).toMatchObject({ level: "low", alerted: false });
    expect(check.queue).not.toHaveBeenCalled();
    const later = build({ freeGiB: 11, history: alertedAt("low", 24) });
    expect(await later.service.run(NOW)).toMatchObject({ alerted: true });
  });

  it("sends one recovery notice, in-app only, when the space comes back", async () => {
    const check = build({ freeGiB: 30, history: alertedAt("critical", 3) });
    expect(await check.service.run(NOW)).toMatchObject({ level: "ok", alerted: true });
    expect(check.queue).toHaveBeenCalledTimes(2);
    expect(check.queue.mock.calls.map(([input]) => [input.channel, input.templateKey])).toEqual([
      ["in_app", "system.disk_recovered"],
      ["in_app", "system.disk_recovered"],
    ]);
  });

  it("keeps notifying the others when one notice fails, and logs no recipient", async () => {
    const check = build({ freeGiB: 8, failNoticeFor: "sa-1" });
    expect(await check.service.run(NOW)).toMatchObject({ alerted: true });
    expect(check.queue).toHaveBeenCalledTimes(4);
    const failed = check.entries.filter(({ event }) => event === "system.disk_check.notice_failed");
    expect(failed).toHaveLength(2);
    expect(JSON.stringify(check.entries)).not.toContain("sa-1");
  });

  it("records no alert when nobody could be told, so the next run tries again", async () => {
    const nobody = build({ freeGiB: 8, recipients: [] });
    expect(await nobody.service.run(NOW)).toMatchObject({ level: "critical", alerted: false });
    expect(nobody.entries.map(({ event }) => event)).toContain("system.disk_check.no_recipients");
    const allFailed = build({ freeGiB: 8, recipients: ["sa-1"], failNoticeFor: "sa-1" });
    expect(await allFailed.service.run(NOW)).toMatchObject({ alerted: false });
  });

  it("records a failed measurement, alerts no one, and throws so the queue retries", async () => {
    const check = build();
    await expect(check.service.run(NOW)).rejects.toThrow("ENOENT");
    expect(check.fail).toHaveBeenCalledWith("run-1", expect.stringContaining("ENOENT"));
    expect(check.succeed).not.toHaveBeenCalled();
    expect(check.queue).not.toHaveBeenCalled();
  });
});
