import { describe, expect, it } from "vitest";

import { uuid } from "../schemas/common";
import { uuidv7 } from "./ids";

describe("uuidv7", () => {
  it("produces a value the shared uuid schema accepts", () => {
    const id = uuidv7(0x0192_f3a0_7d3e, () => 0.5);
    expect(uuid.parse(id)).toBe(id);
  });

  it("sets the version nibble to 7 and the variant to 10xx", () => {
    const id = uuidv7(Date.now(), () => 0.123);
    expect(id[14]).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("orders by time: a later timestamp sorts after an earlier one", () => {
    const earlier = uuidv7(1_000, () => 0);
    const later = uuidv7(2_000, () => 0);
    expect(earlier < later).toBe(true);
  });
});
