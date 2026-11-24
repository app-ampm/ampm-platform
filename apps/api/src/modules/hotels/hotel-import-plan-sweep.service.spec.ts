import { createMemoryLogger, HOTEL_IMPORT_PREVIEW_TTL_HOURS } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../common/logger.service.js";
import type { PrismaService } from "../../db/prisma.service.js";
import type { Env } from "../../env.js";
import type { JobQueue } from "../../jobs/job-queue.js";
import {
  HotelImportPlanSweepService,
  IMPORT_PLAN_SWEEP_CRON,
  importPlanSweepJob,
} from "./hotel-import-plan-sweep.service.js";
import type { HotelImportRepository } from "./hotel-import.repository.js";

/*
 * The daily clearing of expired import previews' plans (D-181; security.md): a plan holds a file's values,
 * internal notes included, so it is kept no longer than it can be imported. Fakes only; the database side
 * (which rows the clearing matches) is in test/hotel-import-plans.e2e-spec.ts.
 */

const NOW = new Date("2026-11-25T04:00:00.000Z");

function build(options: { readonly worker?: boolean; readonly cleared?: number } = {}) {
  const clearExpiredPlans = vi.fn(async (_types: readonly string[], _cutoff: Date) => {
    if (options.cleared === undefined) throw new Error("canceling statement due to lock timeout");
    return options.cleared;
  });
  const register = vi.fn();
  const scheduleRepeatable = vi.fn(async () => undefined);
  const create = vi.fn(async () => ({ id: "run-1" }));
  const update = vi.fn(async () => ({ id: "run-1" }));
  const { logger, entries } = createMemoryLogger("debug");
  const service = new HotelImportPlanSweepService(
    { register, scheduleRepeatable } as unknown as JobQueue,
    { clearExpiredPlans } as unknown as HotelImportRepository,
    { jobRun: { create, update } } as unknown as PrismaService,
    logger as unknown as AppLogger,
    { JOB_WORKER: options.worker ?? false } as unknown as Env,
  );
  return { service, clearExpiredPlans, register, scheduleRepeatable, create, update, entries };
}

describe("HotelImportPlanSweepService", () => {
  it("registers the job but schedules it, daily, only in the worker process", async () => {
    const api = build({ cleared: 0 });
    await api.service.onModuleInit();
    expect(api.register).toHaveBeenCalledWith(importPlanSweepJob, expect.any(Function));
    expect(api.scheduleRepeatable).not.toHaveBeenCalled();
    const worker = build({ worker: true, cleared: 0 });
    await worker.service.onModuleInit();
    expect(worker.scheduleRepeatable).toHaveBeenCalledWith(
      importPlanSweepJob,
      IMPORT_PLAN_SWEEP_CRON,
      {},
    );
    expect(IMPORT_PLAN_SWEEP_CRON).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it("clears the hotel imports' plans older than a preview's time limit, recording the run", async () => {
    const api = build({ cleared: 3 });
    expect(await api.service.run(NOW)).toBe(3);
    const cutoff = new Date(NOW.getTime() - HOTEL_IMPORT_PREVIEW_TTL_HOURS * 60 * 60 * 1000);
    expect(api.clearExpiredPlans).toHaveBeenCalledWith(
      ["hotels", "hotel_rooms", "hotel_venues"],
      cutoff,
    );
    expect(api.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobName: "hotels.imports.clear_expired_plans",
        idempotencyKey: "hotels.imports.clear_expired_plans.2026-11-25",
      }),
    });
    expect(api.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "succeeded", detailJson: { cleared: 3 } }),
    });
    expect(api.entries.map(({ event }) => event)).toContain("hotels.import_plans_cleared");
  });

  it("logs nothing when there was nothing to clear", async () => {
    const api = build({ cleared: 0 });
    expect(await api.service.run(NOW)).toBe(0);
    expect(api.entries).toEqual([]);
  });

  it("records a failed run and throws, so the queue retries it", async () => {
    const api = build();
    await expect(api.service.run(NOW)).rejects.toThrow("lock timeout");
    expect(api.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "failed", error: expect.stringContaining("lock") }),
    });
  });
});
