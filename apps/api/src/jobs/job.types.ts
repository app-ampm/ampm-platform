import type { z } from "zod";

/** The retry policy applied before a job is dead-lettered (BullMQ `attempts` + exponential backoff). */
export interface JobPolicy {
  readonly attempts: number;
  readonly backoffMs: number;
}

/** A typed job: a stable name, the Zod schema its payload must satisfy, and its retry policy. */
export interface JobDefinition<T> {
  readonly name: string;
  readonly schema: z.ZodType<T>;
  readonly policy: JobPolicy;
}

/**
 * Declares a job. Defaults: three attempts with one second of exponential backoff (api.md).
 *
 * @example
 * export const sendNotification = defineJob("notification.send", notificationJob);
 */
export function defineJob<T>(
  name: string,
  schema: z.ZodType<T>,
  policy: Partial<JobPolicy> = {},
): JobDefinition<T> {
  return {
    name,
    schema,
    policy: { attempts: policy.attempts ?? 3, backoffMs: policy.backoffMs ?? 1000 },
  };
}

/** Runs one job; throwing asks the driver to retry per the job's policy, then dead-letter. */
export type JobHandler<T> = (payload: T) => Promise<void>;

export interface EnqueueOptions {
  /** De-duplicates: enqueuing the same key again is a no-op (BullMQ `jobId`, or the inline seen-set). */
  readonly idempotencyKey?: string;
}

/** The transport behind the queue: inline in development and tests, BullMQ on Redis in production. */
export interface JobDriver {
  register(name: string, policy: JobPolicy, run: (payload: unknown) => Promise<void>): void;
  enqueue(name: string, payload: unknown, options: EnqueueOptions): Promise<void>;
  /** Schedules a job on a cron pattern (a BullMQ repeatable); a no-op inline, where there is no scheduler. */
  scheduleRepeatable(name: string, cronPattern: string, payload: unknown): Promise<void>;
  /** Releases resources (the BullMQ/Redis connections); a no-op for the inline driver. */
  close(): Promise<void>;
}

export const JOB_DRIVER = Symbol("JOB_DRIVER");
