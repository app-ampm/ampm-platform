import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { Env } from "../../../env.js";
import type { JobQueue } from "../../../jobs/job-queue.js";
import type { HotelFormChallengesRepository } from "./hotel-form-challenges.repository.js";
import {
  CHALLENGE_SWEEP_CRON,
  challengeSweepJob,
  HotelFormChallengeSweepService,
} from "./hotel-form-challenge-sweep.service.js";

/*
 * The hourly retirement of abandoned code challenges (D-189 §1; D-180's retention): a challenge whose code
 * expired unused keeps its claimant's name, designation and mobile until something retires it, so every
 * hour the expired ones are retired and their claims cleared, each run recorded on job_runs. Fakes only;
 * which rows the update matches is in test/hotel-form-sweep.e2e-spec.ts.
 */

const NOW = new Date("2026-11-25T10:17:00.000Z");

function build(options: { readonly worker?: boolean; readonly retired?: number } = {}) {
  const retireExpired = vi.fn(async (_now: Date) => {
    if (options.retired === undefined) throw new Error("canceling statement due to lock timeout");
    return options.retired;
  });
  const register = vi.fn();
  const scheduleRepeatable = vi.fn(async () => undefined);
  const create = vi.fn(async () => ({ id: "run-1" }));
  const update = vi.fn(async () => ({ id: "run-1" }));
  const { logger, entries } = createMemoryLogger("debug");
  const service = new HotelFormChallengeSweepService(
    { register, scheduleRepeatable } as unknown as JobQueue,
    { retireExpired } as unknown as HotelFormChallengesRepository,
    { jobRun: { create, update } } as unknown as PrismaService,
    logger as unknown as AppLogger,
    { JOB_WORKER: options.worker ?? false } as unknown as Env,
  );
  return { service, retireExpired, register, scheduleRepeatable, create, update, entries };
}

describe("HotelFormChallengeSweepService", () => {
  it("registers the job everywhere and schedules it hourly in the worker only", async () => {
    const api = build({ retired: 0 });
    await api.service.onModuleInit();
    expect(api.register).toHaveBeenCalledWith(challengeSweepJob, expect.any(Function));
    expect(api.scheduleRepeatable).not.toHaveBeenCalled();
    const worker = build({ worker: true, retired: 0 });
    await worker.service.onModuleInit();
    expect(worker.scheduleRepeatable).toHaveBeenCalledWith(
      challengeSweepJob,
      CHALLENGE_SWEEP_CRON,
      {},
    );
    expect(CHALLENGE_SWEEP_CRON).toMatch(/^\d+ \* \* \* \*$/);
  });

  it("retires the challenges expired by now and records the run with its count", async () => {
    const built = build({ retired: 4 });
    expect(await built.service.run(NOW)).toBe(4);
    expect(built.retireExpired).toHaveBeenCalledWith(NOW);
    expect(built.create).toHaveBeenCalledWith({
      data: {
        jobName: "hotel_form.challenges.retire_expired",
        idempotencyKey: "hotel_form.challenges.retire_expired.2026-11-25T10",
        startedAt: expect.any(Date),
      },
    });
    expect(built.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { status: "succeeded", detailJson: { retired: 4 }, finishedAt: expect.any(Date) },
    });
    expect(built.entries.map((entry) => entry.event)).toContain("hotel_form.challenges_retired");
  });

  it("records a failed run and rethrows, so the job retries", async () => {
    const built = build();
    await expect(built.service.run(NOW)).rejects.toThrow("lock timeout");
    expect(built.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: {
        status: "failed",
        error: "canceling statement due to lock timeout",
        finishedAt: expect.any(Date),
      },
    });
  });

  it("stays quiet when there was nothing to retire", async () => {
    const built = build({ retired: 0 });
    await built.service.run(NOW);
    expect(built.entries.map((entry) => entry.event)).not.toContain(
      "hotel_form.challenges_retired",
    );
  });
});
