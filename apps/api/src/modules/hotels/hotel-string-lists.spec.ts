import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import { stringListInput } from "./hotel-string-lists.js";

describe("stringListInput", () => {
  it("writes SQL NULL for null, which clears the column", () => {
    expect(stringListInput(null)).toBe(Prisma.DbNull);
  });

  it("leaves the column untouched for undefined", () => {
    expect(stringListInput(undefined)).toBeUndefined();
  });

  it("writes a list as its JSON array, entries in order", () => {
    expect(stringListInput(["Pool", "Spa"])).toEqual(["Pool", "Spa"]);
  });
});
