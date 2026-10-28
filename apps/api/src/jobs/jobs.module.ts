import { Global, Module } from "@nestjs/common";

import { AppLogger } from "../common/logger.service.js";
import { ENV, type Env } from "../env.js";
import { BullMqJobDriver } from "./bullmq.driver.js";
import { EventBus } from "./event-bus.js";
import { InlineJobDriver } from "./inline.driver.js";
import { JobQueue } from "./job-queue.js";
import { JOB_DRIVER, type JobDriver } from "./job.types.js";

/**
 * The job runner and the domain-event bus (D-031), available everywhere. The driver is chosen by
 * the environment: `REDIS_URL` present runs BullMQ (workers only in the worker process, where
 * `JOB_WORKER` is true), absent runs the inline driver (development without Redis, and tests).
 */
@Global()
@Module({
  providers: [
    {
      provide: JOB_DRIVER,
      useFactory: (env: Env, logger: AppLogger): JobDriver =>
        env.REDIS_URL
          ? new BullMqJobDriver(env.REDIS_URL, logger, env.JOB_WORKER)
          : new InlineJobDriver(logger),
      inject: [ENV, AppLogger],
    },
    JobQueue,
    EventBus,
  ],
  exports: [JobQueue, EventBus],
})
export class JobsModule {}
