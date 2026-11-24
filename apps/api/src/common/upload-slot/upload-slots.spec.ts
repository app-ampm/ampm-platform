import { describe, expect, it } from "vitest";

import {
  UPLOAD_SLOTS_PER_PRINCIPAL,
  UPLOAD_SLOTS_PER_PROCESS,
  UploadSlots,
} from "./upload-slots.js";

describe("UploadSlots (D-187)", () => {
  it("holds two uploads per owner and four per process", () => {
    expect([UPLOAD_SLOTS_PER_PRINCIPAL, UPLOAD_SLOTS_PER_PROCESS]).toEqual([2, 4]);
    const slots = new UploadSlots();
    expect(slots.tryTake("user:a")).not.toBeNull();
    expect(slots.tryTake("user:a")).not.toBeNull();
    expect(slots.tryTake("user:a")).toBeNull(); // the owner's two are taken
    expect(slots.tryTake("user:b")).not.toBeNull();
    expect(slots.tryTake("user:c")).not.toBeNull();
    expect(slots.tryTake("user:d")).toBeNull(); // the process's four are taken
    expect(slots.inUse()).toBe(4);
    expect(slots.inUse("user:a")).toBe(2);
  });

  it("gives a slot back once, however often its release is called", () => {
    const slots = new UploadSlots();
    const release = slots.tryTake("user:a");
    slots.tryTake("user:b");
    release?.();
    release?.();
    expect(slots.inUse()).toBe(1);
    expect(slots.inUse("user:a")).toBe(0);
    expect(slots.inUse("user:b")).toBe(1);
  });

  it("frees an owner's slot for the next upload", () => {
    const slots = new UploadSlots();
    const first = slots.tryTake("user:a");
    slots.tryTake("user:a");
    first?.();
    expect(slots.tryTake("user:a")).not.toBeNull();
  });
});
