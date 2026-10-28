import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";

import { AppLogger } from "../common/logger.service.js";
import { ENV, type Env } from "../env.js";
import { JobQueue } from "../jobs/job-queue.js";
import { defineJob } from "../jobs/job.types.js";
import { SessionRepository } from "./session.repository.js";

/** Deletes revoked and idle-expired `sessions` rows so the table does not grow without bound (D-033). */
export const reapSessionsJob = defineJob("session.reap", z.object({}));

/** Hourly in the worker (BullMQ); inline the schedule is skipped, so dev/tests reap only on demand. */
@Injectable()
export class SessionReaperService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly repository: SessionRepository,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jobs.register(reapSessionsJob, async () => {
      await this.reap();
    });
    // Scheduling issues a Redis command, so only the worker does it — the API process must not block
    // its readiness on Redis at boot. The worker is also the only process that runs the reaper.
    if (this.env.JOB_WORKER) await this.jobs.scheduleRepeatable(reapSessionsJob, "0 * * * *", {});
  }

  /** Deletes dead session rows and reports how many; exposed for the worker handler and for tests. */
  async reap(): Promise<number> {
    const removed = await this.repository.reap();
    if (removed > 0) this.logger.info("session.reaped", { removed });
    return removed;
  }
}
