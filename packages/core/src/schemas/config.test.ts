import { describe, expect, it } from "vitest";

import { CONFIG_REGISTRY, storageDiskGuard } from "./config.js";

/*
 * The disk guard (D-177): the worker's disk check warns below `warnGiB` and calls it critical below
 * `floorGiB`, the floor below which the hotel form's uploads will be refused (Slice 9).
 */
describe("storage.disk_guard", () => {
  it("defaults to a 9 GiB floor and a 12 GiB warning level", () => {
    expect(CONFIG_REGISTRY["storage.disk_guard"].default).toEqual({ floorGiB: 9, warnGiB: 12 });
  });

  it("takes a floor of 9 GiB or more with the warning level above it, both up to 1000 GiB", () => {
    expect(storageDiskGuard.safeParse({ floorGiB: 9, warnGiB: 9.5 }).success).toBe(true);
    expect(storageDiskGuard.safeParse({ floorGiB: 20, warnGiB: 40 }).success).toBe(true);
    expect(storageDiskGuard.safeParse({ floorGiB: 999, warnGiB: 1000 }).success).toBe(true);
  });

  it("refuses a floor below 9 GiB", () => {
    expect(storageDiskGuard.safeParse({ floorGiB: 8.9, warnGiB: 12 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: 0, warnGiB: 12 }).success).toBe(false);
  });

  it("refuses a warning level at or below the floor, naming the warning level", () => {
    const equal = storageDiskGuard.safeParse({ floorGiB: 12, warnGiB: 12 });
    expect(equal.success).toBe(false);
    expect(equal.error?.issues[0]?.path).toEqual(["warnGiB"]);
    expect(storageDiskGuard.safeParse({ floorGiB: 20, warnGiB: 12 }).success).toBe(false);
  });

  it("refuses more than 1000 GiB, a value that is not a number, and a missing value", () => {
    expect(storageDiskGuard.safeParse({ floorGiB: 9, warnGiB: 1000.5 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: 1001, warnGiB: 1002 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: "9", warnGiB: 12 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: Number.NaN, warnGiB: 12 }).success).toBe(false);
    expect(storageDiskGuard.safeParse({ floorGiB: 9 }).success).toBe(false);
  });
});
