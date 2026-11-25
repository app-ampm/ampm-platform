import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../../../common/logger.service.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { JobQueue } from "../../../jobs/job-queue.js";
import { defineJob } from "../../../jobs/job.types.js";
import { HotelFormChallengesRepository } from "./hotel-form-challenges.repository.js";

/** The hourly retirement of abandoned code challenges; see HotelFormChallengeSweepService. */
export const challengeSweepJob = defineJob("hotel_form.challenges.retire_expired", z.object({}));

/** Every hour at :17 (UTC on the server), clear of the jobs that run on the hour. */
export const CHALLENGE_SWEEP_CRON = "17 * * * *";

/**
 * Retires every code challenge whose code expired unused, clearing its claim (D-189 §1; D-180's
 * retention): a claimant who never entered their code would otherwise keep their name, designation and
 * mobile on the challenge for as long as the request is kept. A challenge whose tries ran out is retired
 * at once by the verify; this catches the ones abandoned. Registered on boot, scheduled hourly in the
 * worker only (on demand inline, in development and tests), each run recorded on `job_runs`. Idempotent:
 * a retired challenge is not matched again, so a second run retires nothing.
 */
@Injectable()
export class HotelFormChallengeSweepService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly challenges: HotelFormChallengesRepository,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(challengeSweepJob, async () => {
      await this.run();
    });
    // Scheduling issues a Redis command, so only the worker does it (the session reaper's reasoning).
    if (this.env.JOB_WORKER) {
      await this.jobs.scheduleRepeatable(challengeSweepJob, CHALLENGE_SWEEP_CRON, {});
    }
  }

  /** Retires the challenges expired by `now` and records the run; answers how many it retired. */
  async run(now: Date = new Date()): Promise<number> {
    const run = await this.prisma.jobRun.create({
      data: {
        jobName: challengeSweepJob.name,
        idempotencyKey: `${challengeSweepJob.name}.${now.toISOString().slice(0, 13)}`,
        startedAt: new Date(),
      },
    });
    let retired: number;
    try {
      retired = await this.challenges.retireExpired(now);
    } catch (error) {
      await this.recordFailure(run.id, error);
      throw error;
    }
    await this.prisma.jobRun.update({
      where: { id: run.id },
      data: { status: "succeeded", detailJson: { retired }, finishedAt: new Date() },
    });
    if (retired > 0) this.logger.info("hotel_form.challenges_retired", { retired });
    return retired;
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
      this.logger.warn("hotel_form.challenges.record_failed", { error: String(recordError) });
    }
  }
}
