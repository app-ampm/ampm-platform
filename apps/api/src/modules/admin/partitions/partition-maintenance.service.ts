import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import {
  addMonths,
  monthLabel,
  monthOf,
  monthsToKeep,
  PARTITIONED_TABLES,
  partitionName,
} from "./partition-months.js";
import { PartitionsRepository } from "./partitions.repository.js";

/** Keeps the log tables' monthly partitions ahead of time (data.md); see PartitionMaintenanceService. */
export const partitionMaintenanceJob = defineJob("admin.partitions.maintain", z.object({}));

/**
 * The months after the current one that must already have their partitions. The job runs daily, so a run
 * that keeps failing leaves about half a year to notice its `job_runs` rows and error logs.
 */
export const PARTITION_MONTHS_AHEAD = 6;

/** Daily at 02:30 (UTC on the server), clear of the 03:00 demo restore and rate-freshness sweep. */
export const PARTITION_MAINTENANCE_CRON = "30 2 * * *";

/** A month the job refused to create because its DEFAULT partition already holds that month's rows. */
export interface BlockedPartition {
  readonly partition: string;
  readonly defaultPartition: string;
  readonly rows: number;
}

/** What a run did, recorded on its `job_runs` row. */
export interface PartitionMaintenanceOutcome {
  /** The first and last month kept, e.g. `2026-11` and `2027-05`. */
  readonly months: { readonly from: string; readonly to: string };
  /** The partitions this run created; empty when every month was already in place. */
  readonly created: string[];
  readonly blocked: BlockedPartition[];
}

/**
 * Rolls the monthly partitions of `audit_events` and `notifications` forward: for the current month and the
 * six after it, creates each missing partition exactly as the partition migrations do. Registered on boot,
 * scheduled daily in the worker only (on demand inline, in development and tests). Idempotent: a month
 * already attached is skipped, so a second run creates nothing. A month whose rows already sit in DEFAULT is
 * never created (that would fail, and the rows need moving by hand): the run creates the other months,
 * records itself failed, logs an error and throws, so BullMQ retries and then dead-letters it.
 */
@Injectable()
export class PartitionMaintenanceService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly partitions: PartitionsRepository,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(partitionMaintenanceJob, async () => {
      await this.run();
    });
    // Scheduling issues a Redis command, so only the worker does it (the session reaper's reasoning).
    if (this.env.JOB_WORKER) {
      await this.jobs.scheduleRepeatable(partitionMaintenanceJob, PARTITION_MAINTENANCE_CRON, {});
    }
  }

  /**
   * Ensures the months to keep at `now` have their partitions, and records the run on `job_runs`. The
   * outcome fills in as the run goes, so a run that fails part-way (a lock timeout, say) still records and
   * logs the partitions it created before failing.
   */
  async run(now: Date = new Date()): Promise<PartitionMaintenanceOutcome> {
    const run = await this.prisma.jobRun.create({
      data: {
        jobName: partitionMaintenanceJob.name,
        idempotencyKey: `${partitionMaintenanceJob.name}.${now.toISOString().slice(0, 10)}`,
        startedAt: new Date(),
      },
    });
    const outcome = emptyOutcome(now);
    try {
      await this.ensureMonths(now, outcome);
    } catch (error) {
      this.report(outcome);
      await this.recordFailure(run.id, outcome, error);
      throw error;
    }
    const refusal = outcome.blocked.length > 0 ? refusalMessage(outcome.blocked) : null;
    await this.prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: refusal ? "failed" : "succeeded",
        detailJson: toJson(outcome),
        error: refusal?.slice(0, 1024) ?? null,
        finishedAt: new Date(),
      },
    });
    this.report(outcome);
    if (refusal) throw new Error(refusal);
    return outcome;
  }

  /**
   * Creates every missing partition of the months to keep, table by table, into `outcome`. The catalog read
   * takes no lock, so a run with nothing to create locks nothing; a refused month stops neither the later
   * months nor the other table, whose rows would otherwise pile up in DEFAULT too.
   */
  private async ensureMonths(now: Date, outcome: PartitionMaintenanceOutcome): Promise<void> {
    const months = monthsToKeep(now, PARTITION_MONTHS_AHEAD);
    for (const spec of PARTITIONED_TABLES) {
      const { partitions } = await this.partitions.catalog(spec);
      for (const month of months) {
        const partition = partitionName(spec, month);
        if (partitions.has(partition)) continue;
        const result = await this.partitions.createMonth(spec, month);
        if (result.kind === "created") outcome.created.push(partition);
        if (result.kind === "blocked") {
          const { defaultPartition, rows } = result;
          outcome.blocked.push({ partition, defaultPartition, rows });
        }
      }
    }
  }

  private report(outcome: PartitionMaintenanceOutcome): void {
    if (outcome.created.length > 0) {
      this.logger.info("admin.partitions_created", { created: outcome.created });
    }
    for (const refused of outcome.blocked) {
      this.logger.error("admin.partition_blocked", { ...refused });
    }
  }

  /** Marks the run failed; if even that write fails (the database may be the outage), it logs and gives up. */
  private async recordFailure(
    runId: string,
    outcome: PartitionMaintenanceOutcome,
    error: unknown,
  ): Promise<void> {
    try {
      await this.prisma.jobRun.update({
        where: { id: runId },
        data: {
          status: "failed",
          detailJson: toJson(outcome),
          error: failureMessage(error),
          finishedAt: new Date(),
        },
      });
    } catch (recordError) {
      this.logger.warn("admin.partitions.record_failed", { error: failureMessage(recordError) });
    }
  }
}

/** A run's outcome before it has done anything: the months it keeps, nothing created or refused yet. */
function emptyOutcome(now: Date): PartitionMaintenanceOutcome {
  const current = monthOf(now);
  const last = addMonths(current, PARTITION_MONTHS_AHEAD);
  return { months: { from: monthLabel(current), to: monthLabel(last) }, created: [], blocked: [] };
}

/** Round-trips the outcome to a plain JSON value for the Json column (the audit.service.ts idiom). */
function toJson(outcome: PartitionMaintenanceOutcome): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(outcome)) as Prisma.InputJsonValue;
}

/** The run's error when DEFAULT blocks a month: which partitions, how many rows, and where the fix is written. */
function refusalMessage(blocked: readonly BlockedPartition[]): string {
  const list = blocked
    .map(({ partition, defaultPartition, rows }) => `${partition} (${rows} in ${defaultPartition})`)
    .join(", ");
  return (
    `Not created, because the DEFAULT partition already holds rows of the month: ${list}. ` +
    "Move those rows into the month's partition by hand (docs/data-model.md, partition maintenance)."
  );
}

/** A short note for the `job_runs` row. The job reads only the catalog and row counts, so it holds no record. */
function failureMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1024);
}
