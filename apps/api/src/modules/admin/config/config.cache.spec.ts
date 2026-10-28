import { describe, expect, it } from "vitest";

import { ConfigCache } from "./config.cache.js";

const VALUE = { staffMinutes: 720 };
const FIVE_MINUTES = 5 * 60 * 1000;

describe("ConfigCache", () => {
  it("keeps an entry for five minutes and no longer", () => {
    let now = 1_000;
    const cache = new ConfigCache(undefined, () => now);
    cache.set("session.idle_timeouts", VALUE);
    now += FIVE_MINUTES - 1;
    expect(cache.get("session.idle_timeouts")).toBe(VALUE);
    now += 1;
    expect(cache.get("session.idle_timeouts")).toBeUndefined();
  });

  it("drops a key on invalidation, as a configuration write requires", () => {
    const cache = new ConfigCache(FIVE_MINUTES, () => 0);
    cache.set("a", VALUE);
    cache.set("b", VALUE);
    cache.invalidate("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(VALUE);
  });

  it("clears every key", () => {
    const cache = new ConfigCache(FIVE_MINUTES, () => 0);
    cache.set("a", VALUE);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
