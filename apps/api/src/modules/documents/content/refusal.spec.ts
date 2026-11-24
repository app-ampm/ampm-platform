import { describe, expect, it } from "vitest";

import { ContentRefusal, need, refuse } from "./refusal.js";

describe("refusal helpers", () => {
  it("refuse throws a ContentRefusal with its reason and detail", () => {
    expect(() => refuse("macros", "a VBA project")).toThrow(ContentRefusal);
    try {
      refuse("macros", "a VBA project");
    } catch (error) {
      expect(error).toMatchObject({ reason: "macros", detail: "a VBA project" });
    }
  });

  it.each([
    [0, 4, true],
    [6, 4, true],
    [7, 4, false],
    [-1, 2, false],
    [2, Number.NaN, false],
  ])("need(offset %i, length %i) inside 10 bytes is %s", (offset, length, inside) => {
    const check = (): void => need(Buffer.alloc(10), offset, length, "a field");
    if (inside) expect(check).not.toThrow();
    else expect(check).toThrow(ContentRefusal);
  });
});
