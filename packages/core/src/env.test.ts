import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseEnv } from "./env";

describe("parseEnv", () => {
  const schema = z.object({
    PORT: z.coerce.number().int(),
    NODE_ENV: z.enum(["development", "test", "production"]),
  });

  it("returns typed values", () => {
    expect(parseEnv(schema, { PORT: "3900", NODE_ENV: "test" })).toEqual({
      PORT: 3900,
      NODE_ENV: "test",
    });
  });

  it("names every invalid variable", () => {
    expect(() => parseEnv(schema, { PORT: "x" })).toThrow(/PORT.*NODE_ENV/s);
  });
});
