import type { Entitlements } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import { EntitlementCache } from "./entitlement.cache.js";

// The cache never reads the value, so any entitlements object will do; the cast keeps this test
// independent of the entitlement shape, which the policy package owns.
const VALUE = { modules: ["wedding_workspace"] } as unknown as Entitlements;
const FIVE_MINUTES = 5 * 60 * 1000;

describe("EntitlementCache", () => {
  it("keeps an entry for five minutes and no longer (permission-matrix §1)", () => {
    let now = 1_000;
    const cache = new EntitlementCache(undefined, () => now);
    cache.set("u-1", VALUE);
    now += FIVE_MINUTES - 1;
    expect(cache.get("u-1")).toBe(VALUE);
    now += 1;
    expect(cache.get("u-1")).toBeUndefined();
    // The expired entry is gone, not just hidden: a later clock rewind cannot revive it.
    now -= 10;
    expect(cache.get("u-1")).toBeUndefined();
  });

  it("drops an entry on invalidation, as a role or membership change requires", () => {
    const cache = new EntitlementCache(FIVE_MINUTES, () => 0);
    cache.set("u-1", VALUE);
    cache.set("u-2", VALUE);
    cache.invalidate("u-1");
    expect(cache.get("u-1")).toBeUndefined();
    expect(cache.get("u-2")).toBe(VALUE);
  });
});
