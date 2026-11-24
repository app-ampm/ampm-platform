import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { HOTEL_IMPORT_PREVIEW_TTL_HOURS } from "@ampm/core";
import { z } from "zod";

import { AppLogger } from "../../common/logger.service.js";
import { PrismaService } from "../../db/prisma.service.js";
import { ENV, type Env } from "../../env.js";
import { JobQueue } from "../../jobs/job-queue.js";
import { defineJob } from "../../jobs/job.types.js";
import { HOTELS_IMPORT, RATES_IMPORT, ROOMS_IMPORT, VENUES_IMPORT } from "./hotel-import.kinds.js";
import { HotelImportRepository } from "./hotel-import.repository.js";

/** The daily clearing of expired staff import previews' plans (D-181); see HotelImportPlanSweepService. */
export const importPlanSweepJob = defineJob("hotels.imports.clear_expired_plans", z.object({}));

/** Daily at 04:00 (UTC on the server), clear of the 02:30 partition run and the 03:00 jobs. */
export const IMPORT_PLAN_SWEEP_CRON = "0 4 * * *";

const HOUR_MS = 60 * 60 * 1000;

/** The job types whose previews keep a plan: the staff hotel imports, each kind's own. */
const IMPORT_TYPES = [HOTELS_IMPORT, ROOMS_IMPORT, VENUES_IMPORT, RATES_IMPORT].map(
  (kind) => kind.importType,
);

/**
 * Clears the stored plan of every staff hotel import preview that can no longer be imported: older than
 * HOTEL_IMPORT_PREVIEW_TTL_HOURS, or left on a job no longer validating. A plan holds the file's values,
 * internal notes and rates included (RESTRICTED-NOTES), so it is kept no longer than it can be used
 * (security.md); an import that finds its preview expired clears that plan at once, and this catches
 * every preview never imported again. The job row stays, with its value-free report. Registered on boot,
 * scheduled daily in the worker only (on demand inline, in development and tests), each run recorded on
 * `job_runs`. Idempotent: a cleared plan is not matched again, so a second run clears nothing.
 */
@Injectable()
export class HotelImportPlanSweepService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly imports: HotelImportRepository,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(importPlanSweepJob, async () => {
      await this.run();
    });
    // Scheduling issues a Redis command, so only the worker does it (the session reaper's reasoning).
    if (this.env.JOB_WORKER) {
      await this.jobs.scheduleRepeatable(importPlanSweepJob, IMPORT_PLAN_SWEEP_CRON, {});
    }
  }

  /** Clears the plans expired at `now` and records the run; answers how many it cleared. */
  async run(now: Date = new Date()): Promise<number> {
    const run = await this.prisma.jobRun.create({
      data: {
        jobName: importPlanSweepJob.name,
        idempotencyKey: `${importPlanSweepJob.name}.${now.toISOString().slice(0, 10)}`,
        startedAt: new Date(),
      },
    });
    const cutoff = new Date(now.getTime() - HOTEL_IMPORT_PREVIEW_TTL_HOURS * HOUR_MS);
    let cleared: number;
    try {
      cleared = await this.imports.clearExpiredPlans(IMPORT_TYPES, cutoff);
    } catch (error) {
      await this.recordFailure(run.id, error);
      throw error;
    }
    await this.prisma.jobRun.update({
      where: { id: run.id },
      data: { status: "succeeded", detailJson: { cleared }, finishedAt: new Date() },
    });
    if (cleared > 0) this.logger.info("hotels.import_plans_cleared", { cleared });
    return cleared;
  }

  /** Marks the run failed; if even that write fails (the database may be the outage), it logs and gives up. */
  private async recordFailure(runId: string, error: unknown): Promise<void> {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1024);
    try {
      await this.prisma.jobRun.update({
        where: { id: runId },
        data: { status: "failed", error: message, finishedAt: new Date() },
      });
    } catch (recordError) {
      this.logger.warn("hotels.import_plans.record_failed", { error: String(recordError) });
    }
  }
}
