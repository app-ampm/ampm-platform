import type { LogFields, Logger } from "@ampm/core";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

import type { EnqueueOptions, JobDriver, JobPolicy } from "./job.types.js";

type JobLogger = Pick<Logger, "info" | "warn" | "error">;

interface Registration {
  readonly policy: JobPolicy;
  readonly run: (payload: unknown) => Promise<void>;
  readonly onDeadLetter?: (payload: unknown) => Promise<void>;
}

/**
 * The production transport: a BullMQ queue per job name on a shared Redis connection, with `jobId`
 * de-duplication (idempotency), `attempts` and exponential `backoff`. A job still failing after its
 * attempts stays in BullMQ's failed set — the dead-letter. Workers run only in the worker process
 * (`runWorkers`); the API process registers queues so it can enqueue but consumes nothing. No
 * Redis-backed contract test yet — it is added when a real job lands and CI gains a Redis service.
 */
export class BullMqJobDriver implements JobDriver {
  private readonly connection: Redis;
  private readonly registrations = new Map<string, Registration>();
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(
    redisUrl: string,
    private readonly logger: JobLogger,
    private readonly runWorkers: boolean,
  ) {
    // maxRetriesPerRequest must be null for the blocking connection BullMQ workers use.
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }

  register(
    name: string,
    policy: JobPolicy,
    run: (payload: unknown) => Promise<void>,
    onDeadLetter?: (payload: unknown) => Promise<void>,
  ): void {
    this.registrations.set(name, { policy, run, onDeadLetter });
    this.queue(name);
    if (!this.runWorkers) return;
    const worker = new Worker(name, async (job) => run(job.data), { connection: this.connection });
    worker.on("failed", (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      const fields: LogFields = { job: name, id: job.id ?? null, error: String(error) };
      // Release the queued state (clear the invite token, mark the row failed) before logging, so the
      // dead-letter is terminal and holds no secret at rest (D-044); a failing handler must not mask it.
      void this.deadLetter(name, job.data).finally(() =>
        this.logger.error("job.dead_lettered", fields),
      );
    });
    this.workers.push(worker);
  }

  private async deadLetter(name: string, payload: unknown): Promise<void> {
    const handler = this.registrations.get(name)?.onDeadLetter;
    if (!handler) return;
    try {
      await handler(payload);
    } catch (error) {
      this.logger.error("job.dead_letter_handler_failed", { job: name, error: String(error) });
    }
  }

  async enqueue(name: string, payload: unknown, options: EnqueueOptions): Promise<void> {
    const registration = this.registrations.get(name);
    if (!registration) throw new Error(`No handler registered for job "${name}"`);
    await this.queue(name).add(name, payload, {
      // BullMQ 6 refuses a custom jobId that contains ':' unless it splits into exactly three segments
      // (Job.addJob), so idempotency keys must not use ':' as a separator — callers use '.' (A1). A
      // bad key would throw here, which the Redis-backed driver test guards against.
      ...(options.idempotencyKey !== undefined ? { jobId: options.idempotencyKey } : {}),
      attempts: registration.policy.attempts,
      backoff: { type: "exponential", delay: registration.policy.backoffMs },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async scheduleRepeatable(name: string, cronPattern: string, payload: unknown): Promise<void> {
    const registration = this.registrations.get(name);
    if (!registration) throw new Error(`No handler registered for job "${name}"`);
    // BullMQ v6 job scheduler: upsert is idempotent on the scheduler id, so scheduling from each
    // process (API and worker) is safe; the worker runs the enqueued instances. The scheduled instances
    // carry the job's retry policy, exactly as enqueue() does, so a failed run retries with backoff
    // then dead-letters rather than failing on the first attempt.
    await this.queue(name).upsertJobScheduler(
      name,
      { pattern: cronPattern },
      {
        name,
        data: payload,
        opts: {
          attempts: registration.policy.attempts,
          backoff: { type: "exponential", delay: registration.policy.backoffMs },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    await this.connection.quit();
  }

  private queue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) return existing;
    const queue = new Queue(name, { connection: this.connection });
    this.queues.set(name, queue);
    return queue;
  }
}
