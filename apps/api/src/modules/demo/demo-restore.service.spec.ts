import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../common/logger.service.js";
import type { PrismaService } from "../../db/prisma.service.js";
import type { Env } from "../../env.js";
import type { JobQueue } from "../../jobs/job-queue.js";
import type { DemoTableRestore } from "./demo-baseline.js";
import type { DemoBaselineRepository } from "./demo-baseline.repository.js";
import { DemoRestoreService, restoreDemoJob } from "./demo-restore.service.js";

const COUNTS: DemoTableRestore[] = [{ table: "users", deleted: 2, inserted: 1 }];

function build(options: { worker?: boolean; fail?: boolean } = {}) {
  const register = vi.fn();
  const scheduleRepeatable = vi.fn(async () => undefined);
  const jobs = { register, scheduleRepeatable } as unknown as JobQueue;
  const restore = vi.fn(async (): Promise<DemoTableRestore[]> => {
    if (options.fail) throw new Error("reset boom");
    return COUNTS;
  });
  const baseline = { restore } as unknown as DemoBaselineRepository;
  const create = vi.fn(async () => ({ id: "run-1" }));
  const update = vi.fn(async () => ({ id: "run-1" }));
  const prisma = { jobRun: { create, update } } as unknown as PrismaService;
  const { logger } = createMemoryLogger();
  const env = { JOB_WORKER: options.worker ?? false } as Env;
  const service = new DemoRestoreService(
    jobs,
    baseline,
    prisma,
    logger as unknown as AppLogger,
    env,
  );
  return { service, register, scheduleRepeatable, create, update };
}

describe("DemoRestoreService", () => {
  it("registers the job but schedules it only in the worker process", async () => {
    const api = build({ worker: false });
    await api.service.onModuleInit();
    expect(api.register).toHaveBeenCalledWith(restoreDemoJob, expect.any(Function));
    expect(api.scheduleRepeatable).not.toHaveBeenCalled();

    const worker = build({ worker: true });
    await worker.service.onModuleInit();
    expect(worker.scheduleRepeatable).toHaveBeenCalledWith(restoreDemoJob, "0 3 * * *", {});
  });

  it("records a succeeded job run with the per-table counts", async () => {
    const api = build();
    const outcome = await api.service.restore("key-1");
    expect(outcome.tables).toEqual(COUNTS);
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: "key-1" }) }),
    );
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "succeeded" }) }),
    );
  });

  it("records a failed job run and rethrows when the reset fails", async () => {
    const api = build({ fail: true });
    await expect(api.service.restore("key-2")).rejects.toThrow("reset boom");
    expect(api.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", error: "reset boom" }),
      }),
    );
  });

  it("the nightly handler restores under a per-day idempotency key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T03:00:00Z"));
    try {
      const api = build();
      const restore = vi.spyOn(api.service, "restore").mockResolvedValue({ tables: [] });
      await api.service.onModuleInit();
      const handler = api.register.mock.calls[0]?.[1] as () => Promise<void>;
      await handler();
      expect(restore).toHaveBeenCalledWith("demo.restore:2026-10-29");
    } finally {
      vi.useRealTimers();
    }
  });
});
