import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { InlineJobDriver } from "./inline.driver.js";
import type { JobPolicy } from "./job.types.js";

const POLICY: JobPolicy = { attempts: 3, backoffMs: 0 };

describe("InlineJobDriver", () => {
  it("runs a registered handler when a job is enqueued", async () => {
    const { logger } = createMemoryLogger();
    const driver = new InlineJobDriver(logger);
    const seen: unknown[] = [];
    driver.register("demo", POLICY, async (payload) => {
      seen.push(payload);
    });
    await driver.enqueue("demo", { n: 1 }, {});
    expect(seen).toEqual([{ n: 1 }]);
  });

  it("runs once per idempotency key (a replay is a no-op)", async () => {
    const { logger } = createMemoryLogger();
    const driver = new InlineJobDriver(logger);
    let count = 0;
    driver.register("demo", POLICY, async () => {
      count += 1;
    });
    await driver.enqueue("demo", {}, { idempotencyKey: "k1" });
    await driver.enqueue("demo", {}, { idempotencyKey: "k1" });
    expect(count).toBe(1);
  });

  it("retries a throwing handler and succeeds within its attempts", async () => {
    const { logger, entries } = createMemoryLogger();
    const driver = new InlineJobDriver(logger);
    let attempts = 0;
    driver.register("demo", POLICY, async () => {
      attempts += 1;
      if (attempts < 2) throw new Error("transient");
    });
    await driver.enqueue("demo", {}, {});
    expect(attempts).toBe(2);
    expect(entries.some((entry) => entry.event === "job.dead_lettered")).toBe(false);
  });

  it("dead-letters a handler that keeps throwing, after its attempts", async () => {
    const { logger, entries } = createMemoryLogger();
    const driver = new InlineJobDriver(logger);
    let attempts = 0;
    driver.register("demo", { attempts: 2, backoffMs: 0 }, async () => {
      attempts += 1;
      throw new Error("always");
    });
    await driver.enqueue("demo", {}, {});
    expect(attempts).toBe(2);
    const deadLetter = entries.find((entry) => entry.event === "job.dead_lettered");
    expect(deadLetter?.level).toBe("error");
    expect(deadLetter?.fields["job"]).toBe("demo");
  });

  it("throws when enqueuing a job with no registered handler", async () => {
    const { logger } = createMemoryLogger();
    const driver = new InlineJobDriver(logger);
    await expect(driver.enqueue("missing", {}, {})).rejects.toThrow(/missing/);
  });
});
