import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import {
  JOB_DRIVER,
  type EnqueueOptions,
  type JobDeadLetterHandler,
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

  /**
   * Wires a handler to a job. An optional `onDeadLetter` runs once after every attempt has failed, to
   * release what the queued state held (the send handler clears the invite token and marks the row
   * `failed`); the payload is re-validated on both paths, since it came back through the driver.
   */
  register<T>(
    job: JobDefinition<T>,
    handler: JobHandler<T>,
    onDeadLetter?: JobDeadLetterHandler<T>,
  ): void {
    this.driver.register(
      job.name,
      job.policy,
      async (payload) => {
        // Re-validate on the consumer side: the payload came back through the driver (JSON on Redis).
        await handler(job.schema.parse(payload));
      },
      onDeadLetter
        ? async (payload) => {
            await onDeadLetter(job.schema.parse(payload));
          }
        : undefined,
    );
  }

  async enqueue<T>(job: JobDefinition<T>, payload: T, options: EnqueueOptions = {}): Promise<void> {
    await this.driver.enqueue(job.name, job.schema.parse(payload), options);
  }

  /** Schedules a job to run on a cron pattern; the worker process runs it (no-op without Redis). */
  async scheduleRepeatable<T>(
    job: JobDefinition<T>,
    cronPattern: string,
    payload: T,
  ): Promise<void> {
    await this.driver.scheduleRepeatable(job.name, cronPattern, job.schema.parse(payload));
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
