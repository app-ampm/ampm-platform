import { parseEnv } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { publicEnvSchema } from "./env";

describe("public site configuration", () => {
  it("defaults to the local API and the local client portal (Expo on 8082)", () => {
    const parsed = parseEnv(publicEnvSchema, {});
    expect(parsed.NEXT_PUBLIC_API_URL).toBe("http://localhost:3900");
    expect(parsed.NEXT_PUBLIC_PORTAL_URL).toBe("http://localhost:8082");
  });

  it("takes the portal from NEXT_PUBLIC_PORTAL_URL", () => {
    const parsed = parseEnv(publicEnvSchema, {
      NEXT_PUBLIC_PORTAL_URL: "https://portal.example.test",
    });
    expect(parsed.NEXT_PUBLIC_PORTAL_URL).toBe("https://portal.example.test");
  });

  it("refuses a portal address that is not a URL", () => {
    expect(() => parseEnv(publicEnvSchema, { NEXT_PUBLIC_PORTAL_URL: "portal" })).toThrow(
      /NEXT_PUBLIC_PORTAL_URL/,
    );
  });
});
