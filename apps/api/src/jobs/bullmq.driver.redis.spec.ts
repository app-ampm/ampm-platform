import { randomUUID } from "node:crypto";

import { createMemoryLogger } from "@ampm/core";
import { afterEach, describe, expect, it } from "vitest";

import { BullMqJobDriver } from "./bullmq.driver.js";

const REDIS_URL = process.env.REDIS_URL;

/** A promise a handler can resolve from inside the worker, so the test can await the async processing. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Rejects if the worker never runs within the budget, so a wiring regression fails fast rather than hanging. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * The production transport can only be exercised against a real Redis, so this runs only where
 * REDIS_URL is set — CI's api job sets it for this one file (the inline driver covers everything else
 * and the API's e2e keeps running jobs inline). It is D-031's missing Redis-backed driver test, and it
 * guards A1: a notification idempotency key (`notification.send.<uuid>`) must be a valid BullMQ jobId.
 */
describe.skipIf(!REDIS_URL)("BullMqJobDriver against Redis", () => {
  const drivers: BullMqJobDriver[] = [];

  function makeDriver(): BullMqJobDriver {
    const { logger } = createMemoryLogger();
    const driver = new BullMqJobDriver(REDIS_URL as string, logger, true);
    drivers.push(driver);
    return driver;
  }

  afterEach(async () => {
    while (drivers.length > 0) await drivers.pop()?.close();
  });

  it("enqueues with a notification-shaped idempotency key and runs the handler (A1)", async () => {
    const driver = makeDriver();
    const name = `test.send.${randomUUID()}`;
    const ran = deferred<unknown>();
    driver.register(name, { attempts: 1, backoffMs: 1 }, async (payload) => {
      ran.resolve(payload);
    });
    const notificationId = randomUUID();
    // The key BullMQ previously refused: `notification.send:<uuid>` threw "Custom Id cannot contain :".
    // With the '.' separator it is accepted and the worker runs the job.
    await expect(
      driver.enqueue(
        name,
        { notificationId },
        { idempotencyKey: `notification.send.${notificationId}` },
      ),
    ).resolves.toBeUndefined();
    await expect(withTimeout(ran.promise, 5_000)).resolves.toEqual({ notificationId });
  });

  it("retries a throwing job and runs the dead-letter handler after the final attempt", async () => {
    const driver = makeDriver();
    const name = `test.fail.${randomUUID()}`;
    let attempts = 0;
    const deadLettered = deferred<unknown>();
    driver.register(
      name,
      { attempts: 2, backoffMs: 1 },
      async () => {
        attempts += 1;
        throw new Error("boom");
      },
      async (payload) => {
        deadLettered.resolve(payload);
      },
    );
    const id = randomUUID();
    await driver.enqueue(name, { id }, { idempotencyKey: `test.fail.${id}` });
    await expect(withTimeout(deadLettered.promise, 10_000)).resolves.toEqual({ id });
    expect(attempts).toBe(2);
  });
});
