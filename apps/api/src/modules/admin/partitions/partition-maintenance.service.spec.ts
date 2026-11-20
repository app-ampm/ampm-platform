import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { Env } from "../../../env.js";
import type { JobQueue } from "../../../jobs/job-queue.js";
import {
  PARTITION_MAINTENANCE_CRON,
  PartitionMaintenanceService,
  partitionMaintenanceJob,
} from "./partition-maintenance.service.js";
import { type PartitionedTable, type PartitionMonth, partitionName } from "./partition-months.js";
import type { MonthOutcome, PartitionsRepository } from "./partitions.repository.js";

/** A run on 20 November 2026 keeps November 2026 to May 2027. */
const NOW = new Date("2026-11-20T09:00:00Z");

interface FakeOptions {
  /** Partitions already attached, per table. */
  readonly existing?: readonly string[];
  /** Partitions whose month already has rows in DEFAULT. */
  readonly blocked?: readonly string[];
  readonly worker?: boolean;
  /** The table whose catalog read fails, as a lock timeout would. */
  readonly catalogFailsFor?: string;
}

function build(options: FakeOptions = {}) {
  const existing = new Set(options.existing ?? []);
  const blocked = new Set(options.blocked ?? []);
  const catalog = vi.fn(async (spec: PartitionedTable) => {
    if (spec.table === options.catalogFailsFor) {
      throw new Error("canceling statement due to lock timeout");
    }
    const names = [...existing].filter((name) => name.startsWith(`${spec.table}_`));
    return { partitions: new Set(names), defaultPartition: `${spec.table}_default` };
  });
  const createMonth = vi.fn(
    async (spec: PartitionedTable, month: PartitionMonth): Promise<MonthOutcome> => {
      const name = partitionName(spec, month);
      if (blocked.has(name))
        return { kind: "blocked", defaultPartition: `${spec.table}_default`, rows: 3 };
      existing.add(name);
      return { kind: "created" };
    },
  );
  const partitions = { catalog, createMonth } as unknown as PartitionsRepository;
  const register = vi.fn();
  const scheduleRepeatable = vi.fn(async () => undefined);
  const jobs = { register, scheduleRepeatable } as unknown as JobQueue;
  const create = vi.fn(async () => ({ id: "run-1" }));
  const update = vi.fn(async () => ({ id: "run-1" }));
  const prisma = { jobRun: { create, update } } as unknown as PrismaService;
  const { logger, entries } = createMemoryLogger("debug");
  const env = { JOB_WORKER: options.worker ?? false } as Env;
  const service = new PartitionMaintenanceService(
    jobs,
    partitions,
    prisma,
    logger as unknown as AppLogger,
    env,
  );
  return { service, createMonth, register, scheduleRepeatable, create, update, entries };
}

/** Every partition from November 2026 to May 2027, for both tables. */
const KEPT = ["audit_events", "notifications"].flatMap((table) =>
  ["2026_11", "2026_12", "2027_01", "2027_02", "2027_03", "2027_04", "2027_05"].map(
    (month) => `${table}_${month}`,
  ),
);

describe("PartitionMaintenanceService", () => {
  it("registers the job but schedules it only in the worker process", async () => {
    const api = build({ worker: false });
    await api.service.onModuleInit();
    expect(api.register).toHaveBeenCalledWith(partitionMaintenanceJob, expect.any(Function));
    expect(api.scheduleRepeatable).not.toHaveBeenCalled();

    const worker = build({ worker: true });
    await worker.service.onModuleInit();
    expect(worker.scheduleRepeatable).toHaveBeenCalledWith(
      partitionMaintenanceJob,
      PARTITION_MAINTENANCE_CRON,
      {},
    );
  });

  it("creates only the missing months, then a second run creates nothing", async () => {
    const api = build({ existing: KEPT.filter((name) => !name.endsWith("2027_05")) });
    const first = await api.service.run(NOW);
    expect(first).toEqual({
      months: { from: "2026-11", to: "2027-05" },
      created: ["audit_events_2027_05", "notifications_2027_05"],
      blocked: [],
    });
    expect(api.createMonth).toHaveBeenCalledTimes(2);

    const second = await api.service.run(NOW);
    expect(second.created).toEqual([]);
    expect(api.createMonth).toHaveBeenCalledTimes(2);
  });

  it("records each run on job_runs with a daily idempotency key and the outcome", async () => {
    const api = build({ existing: KEPT });
    await api.service.run(NOW);
    expect(api.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobName: "admin.partitions.maintain",
        idempotencyKey: "admin.partitions.maintain.2026-11-20",
      }),
    });
    expect(api.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "succeeded",
        error: null,
        detailJson: { months: { from: "2026-11", to: "2027-05" }, created: [], blocked: [] },
      }),
    });
  });

  it("refuses a month whose rows sit in DEFAULT, creates the rest, records the failure and throws", async () => {
    const api = build({ blocked: ["notifications_2027_02"] });
    await expect(api.service.run(NOW)).rejects.toThrow(
      /notifications_2027_02 \(3 in notifications_default\).*by hand/,
    );
    // Every other month of both tables was created, the ones after the refused month included.
    expect(api.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "failed",
        error: expect.stringContaining("notifications_2027_02"),
        detailJson: {
          months: { from: "2026-11", to: "2027-05" },
          created: KEPT.filter((name) => name !== "notifications_2027_02"),
          blocked: [
            {
              partition: "notifications_2027_02",
              defaultPartition: "notifications_default",
              rows: 3,
            },
          ],
        },
      }),
    });
    const errors = api.entries.filter((entry) => entry.level === "error");
    expect(errors.map((entry) => entry.event)).toEqual(["admin.partition_blocked"]);
  });

  it("records a database failure with what it created first, and rethrows it for BullMQ to retry", async () => {
    const api = build({ catalogFailsFor: "notifications" });
    await expect(api.service.run(NOW)).rejects.toThrow(/lock timeout/);
    const auditMonths = KEPT.filter((name) => name.startsWith("audit_events_"));
    expect(api.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "failed",
        error: expect.stringContaining("lock timeout"),
        detailJson: {
          months: { from: "2026-11", to: "2027-05" },
          created: auditMonths,
          blocked: [],
        },
      }),
    });
    const created = api.entries.find((entry) => entry.event === "admin.partitions_created");
    expect(created?.fields).toEqual({ created: auditMonths });
  });
});
