import { errors } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "./provider";

/* The query client every app's ApiProvider makes (code.md: server state in TanStack Query). */

/** Whether the client tries a query again after its `count`th failure with `error`. */
function retries(client: ReturnType<typeof createQueryClient>, count: number, error: Error) {
  const retry = client.getDefaultOptions().queries?.retry;
  if (typeof retry !== "function") throw new Error("The client decides each retry itself");
  return retry(count, error);
}

describe("createQueryClient", () => {
  it("tries a network or server failure twice, and never a denial or a validation failure", () => {
    const client = createQueryClient();
    expect(retries(client, 0, errors.internal())).toBe(true);
    expect(retries(client, 1, errors.internal())).toBe(true);
    expect(retries(client, 2, errors.internal())).toBe(false);
    for (const denial of [errors.unauthenticated(), errors.forbidden(), errors.notFound()]) {
      expect(retries(client, 0, denial)).toBe(false);
    }
    expect(retries(client, 0, errors.validation([]))).toBe(false);
  });

  it("leaves a 429 to the page when asked, which counts its Retry-After down instead", () => {
    const counted = createQueryClient({ retryRateLimited: false });
    expect(retries(counted, 0, errors.rateLimited("Too many", 30))).toBe(false);
    expect(retries(counted, 0, errors.internal())).toBe(true);
    expect(retries(createQueryClient(), 0, errors.rateLimited("Too many", 30))).toBe(true);
  });
});
