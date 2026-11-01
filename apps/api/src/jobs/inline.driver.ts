import type { LogFields, Logger } from "@ampm/core";

import type { EnqueueOptions, JobDriver, JobPolicy } from "./job.types.js";

/** The job driver only logs; this is the slice of the logger it needs. */
type JobLogger = Pick<Logger, "info" | "warn" | "error">;

interface Registration {
  readonly policy: JobPolicy;
  readonly run: (payload: unknown) => Promise<void>;
  readonly onDeadLetter?: (payload: unknown) => Promise<void>;
}

/**
 * Runs jobs in-process for development without Redis and for tests: a handler runs immediately,
 * retries up to its policy and is dead-lettered (logged) after that; an idempotency key that has
 * been seen is a no-op. Not for production — the worker there is the BullMQ driver. Safe because a
 * lost inline job is only ever a notification to resend, never source data (D-031, api.md). Retries
 * do not wait for the backoff here, so tests stay fast; BullMQ honours the delay in production.
 */
export class InlineJobDriver implements JobDriver {
  private readonly registrations = new Map<string, Registration>();
  private readonly seen = new Set<string>();

  constructor(private readonly logger: JobLogger) {}

  register(
    name: string,
    policy: JobPolicy,
    run: (payload: unknown) => Promise<void>,
    onDeadLetter?: (payload: unknown) => Promise<void>,
  ): void {
    this.registrations.set(name, { policy, run, onDeadLetter });
  }

  async enqueue(name: string, payload: unknown, options: EnqueueOptions): Promise<void> {
    const registration = this.registrations.get(name);
    if (!registration) throw new Error(`No handler registered for job "${name}"`);
    const key = options.idempotencyKey;
    if (key !== undefined) {
      if (this.seen.has(key)) return;
      this.seen.add(key);
    }
    await this.run(name, registration, payload);
  }

  async scheduleRepeatable(name: string): Promise<void> {
    // Development and tests have no scheduler; repeatable jobs (e.g. the session reaper) run only
    // under the BullMQ worker. Flag it so a missing reap in dev is not a mystery.
    this.logger.info("job.schedule_skipped", { job: name });
  }

  async close(): Promise<void> {
    // Nothing to release in-process.
  }

  private async run(name: string, registration: Registration, payload: unknown): Promise<void> {
    for (let attempt = 1; attempt <= registration.policy.attempts; attempt += 1) {
      try {
        await registration.run(payload);
        return;
      } catch (error) {
        const fields: LogFields = { job: name, attempt, error: String(error) };
        if (attempt >= registration.policy.attempts) {
          await this.deadLetter(name, registration, payload);
          this.logger.error("job.dead_lettered", fields);
          return;
        }
        this.logger.warn("job.retry", fields);
      }
    }
  }

  /** Runs the dead-letter handler once retries are exhausted; a throwing handler must not mask the dead-letter. */
  private async deadLetter(
    name: string,
    registration: Registration,
    payload: unknown,
  ): Promise<void> {
    if (!registration.onDeadLetter) return;
    try {
      await registration.onDeadLetter(payload);
    } catch (error) {
      this.logger.error("job.dead_letter_handler_failed", { job: name, error: String(error) });
    }
  }
}
