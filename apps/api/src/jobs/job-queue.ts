import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import {
  JOB_DRIVER,
  type EnqueueOptions,
  type JobDefinition,
  type JobDriver,
  type JobHandler,
} from "./job.types.js";

/**
 * The typed job API the rest of the app uses. `register` wires a handler to a job (called at
 * start-up by the module that owns the job); `enqueue` validates the payload against the job's
 * schema (contract-first) and hands it to the driver, which de-duplicates, retries and dead-letters.
 *
 * @example
 * this.jobs.register(sendNotification, (payload) => this.send(payload));
 * await this.jobs.enqueue(sendNotification, { notificationId }, { idempotencyKey: notificationId });
 */
@Injectable()
export class JobQueue implements OnModuleDestroy {
  constructor(@Inject(JOB_DRIVER) private readonly driver: JobDriver) {}

  register<T>(job: JobDefinition<T>, handler: JobHandler<T>): void {
    this.driver.register(job.name, job.policy, async (payload) => {
      // Re-validate on the consumer side: the payload came back through the driver (JSON on Redis).
      await handler(job.schema.parse(payload));
    });
  }

  async enqueue<T>(job: JobDefinition<T>, payload: T, options: EnqueueOptions = {}): Promise<void> {
    await this.driver.enqueue(job.name, job.schema.parse(payload), options);
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
