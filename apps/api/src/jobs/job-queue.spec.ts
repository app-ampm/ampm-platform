import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { InlineJobDriver } from "./inline.driver.js";
import { JobQueue } from "./job-queue.js";
import { defineJob } from "./job.types.js";

const greet = defineJob("test.greet", z.object({ name: z.string().min(2) }));

function queue(): JobQueue {
  const { logger } = createMemoryLogger();
  return new JobQueue(new InlineJobDriver(logger));
}

describe("JobQueue", () => {
  it("validates the payload and runs the registered handler", async () => {
    const jobs = queue();
    const seen: string[] = [];
    jobs.register(greet, async (payload) => {
      seen.push(payload.name);
    });
    await jobs.enqueue(greet, { name: "Asha" });
    expect(seen).toEqual(["Asha"]);
  });

  it("rejects a payload that does not match the job's schema", async () => {
    const jobs = queue();
    jobs.register(greet, async () => undefined);
    // Type-valid but schema-invalid (min length 2), so the contract is enforced at runtime.
    await expect(jobs.enqueue(greet, { name: "a" })).rejects.toThrow();
  });
});
