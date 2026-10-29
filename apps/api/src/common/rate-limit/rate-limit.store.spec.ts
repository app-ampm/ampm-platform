import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

import { MemoryRateLimitStore, RedisRateLimitStore } from "./rate-limit.store.js";

/** A Redis whose only method is the Lua `eval` the store calls, returning a scripted reply. */
function fakeRedis(reply: unknown) {
  const evalFn = vi.fn().mockResolvedValue(reply);
  return { store: new RedisRateLimitStore({ eval: evalFn } as unknown as Redis), evalFn };
}

describe("MemoryRateLimitStore", () => {
  it("counts hits within a window", async () => {
    const store = new MemoryRateLimitStore();
    const first = await store.hit("k", 1000);
    expect(first).toEqual({ count: 1, resetMs: 1000 });
    expect((await store.hit("k", 1000)).count).toBe(2);
  });

  it("keeps a separate counter per key", async () => {
    const store = new MemoryRateLimitStore();
    await store.hit("a", 1000);
    expect((await store.hit("b", 1000)).count).toBe(1);
  });

  it("starts a fresh window once the old one has elapsed", async () => {
    const store = new MemoryRateLimitStore();
    await store.hit("k", 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await store.hit("k", 1)).count).toBe(1);
  });
});

describe("RedisRateLimitStore (the production path)", () => {
  it("runs the window as one atomic eval keyed on the caller", async () => {
    const { store, evalFn } = fakeRedis([3, 1500]);
    const hit = await store.hit("rl:auth.activate:ip:1.2.3.4", 60_000);
    expect(hit).toEqual({ count: 3, resetMs: 1500 });
    expect(evalFn).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "rl:auth.activate:ip:1.2.3.4",
      60_000,
    );
  });

  it("falls back to the full window when the TTL has not been set yet", async () => {
    // PTTL returns -1 for a key with no expiry (a race before PEXPIRE lands); never report a negative reset.
    const { store } = fakeRedis([1, -1]);
    expect(await store.hit("k", 60_000)).toEqual({ count: 1, resetMs: 60_000 });
  });

  it("counts a malformed reply as zero rather than silently disabling the limit", async () => {
    // A non-array or non-number reply (a driver/RESP change) must not become a count that never exceeds
    // the limit — that would turn rate limiting off unnoticed. Zero is safe: the guard still enforces.
    for (const reply of [null, "oops", [], ["x", "y"]]) {
      const { store } = fakeRedis(reply);
      expect(await store.hit("k", 60_000)).toEqual({ count: 0, resetMs: 60_000 });
    }
  });
});
