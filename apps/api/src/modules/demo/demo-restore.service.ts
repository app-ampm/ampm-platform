import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../common/logger.service.js";
import { PrismaService } from "../../db/prisma.service.js";
import { ENV, type Env } from "../../env.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { JobQueue } from "../../jobs/job-queue.js";
import { defineJob } from "../../jobs/job.types.js";
import { type DemoTableRestore } from "./demo-baseline.js";
import { DemoBaselineRepository } from "./demo-baseline.repository.js";

/** Restores demo data from the baseline so a prospect always meets a clean demo (data.md, A-28). */
export const restoreDemoJob = defineJob("demo.restore", z.object({}));

/** The outcome of a restore: the per-table counts recorded on the `job_runs` row. */
export interface DemoRestoreOutcome {
  readonly tables: DemoTableRestore[];
}

/**
 * Runs the nightly demo-restore (feature 5.5), modelled on the session reaper: it registers the job and,
 * in the worker only, schedules it; the reset itself lives in `DemoBaselineRepository`. Every run is
 * recorded on a `job_runs` row (api.md). Synthetic demo data is exempt from the Super-Admin deletion
 * approval real-data retention needs (data.md): this job hard-clears demo rows on its own authority (D-047).
 */
@Injectable()
export class DemoRestoreService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly baseline: DemoBaselineRepository,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(restoreDemoJob, async () => {
      await this.restore(this.dailyKey());
    });
    // Scheduling issues a Redis command, so only the worker does it: the API process must not block its
    // readiness on Redis at boot, and the worker is the only process that runs the nightly restore.
    if (this.env.JOB_WORKER) await this.jobs.scheduleRepeatable(restoreDemoJob, "0 3 * * *", {});
  }

  /**
   * Resets demo data to the baseline and records the outcome on a `job_runs` row. Idempotent: the reset is
   * delete-then-reseed to a fixed baseline, so a retry re-applies to the identical state. Records the
   * failure and rethrows so the driver retries then dead-letters per the job's policy.
   */
  async restore(idempotencyKey: string): Promise<DemoRestoreOutcome> {
    const run = await this.prisma.jobRun.create({
      data: { jobName: restoreDemoJob.name, idempotencyKey, startedAt: new Date() },
    });
    try {
      const tables = await this.baseline.restore();
      await this.prisma.jobRun.update({
        where: { id: run.id },
        data: {
          status: "succeeded",
          // Round-trip to a plain JSON value for the Json column (the audit.service.ts idiom).
          detailJson: JSON.parse(JSON.stringify(tables)) as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      this.logger.info("demo.restored", { idempotencyKey, tables });
      return { tables };
    } catch (error) {
      // Record the failure, but never let a failed status-write mask the original error we must rethrow.
      await this.recordFailure(run.id, error);
      throw error;
    }
  }

  /** Marks the run failed; if even that write fails (e.g. the DB is the outage), it logs and gives up. */
  private async recordFailure(runId: string, error: unknown): Promise<void> {
    try {
      await this.prisma.jobRun.update({
        where: { id: runId },
        data: { status: "failed", error: failureMessage(error), finishedAt: new Date() },
      });
    } catch (recordError) {
      this.logger.warn("demo.restore.record_failed", { error: failureMessage(recordError) });
    }
  }

  /** One key per day, so a run's retries share it and the day's attempts are easy to correlate. */
  private dailyKey(): string {
    return `${restoreDemoJob.name}:${new Date().toISOString().slice(0, 10)}`;
  }
}

/** A short, non-sensitive note for the `job_runs` row; demo data is synthetic, so never record more. */
function failureMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1024);
}
