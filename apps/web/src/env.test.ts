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

  it("draws Cloudflare's always-pass test widget unless a Turnstile site key is given", () => {
    expect(parseEnv(publicEnvSchema, {}).NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe(
      "1x00000000000000000000AA",
    );
    const production = parseEnv(publicEnvSchema, {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAGKBfk9-4261LTAN",
    });
    expect(production.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe("0x4AAAAAAGKBfk9-4261LTAN");
  });

  it("refuses a Turnstile site key that is not one", () => {
    for (const value of ["", "dev-bot-check", " 0x4AAAAAAGKBfk9-4261LTAN", '"0x4AAAAAAGKBfk9"'])
      expect(() => parseEnv(publicEnvSchema, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: value })).toThrow(
        /NEXT_PUBLIC_TURNSTILE_SITE_KEY/,
      );
  });
});
