import { describe, expect, it } from "vitest";

import { assertDevBuild, type DevGateEnv } from "./dev-gate.js";

// The gate checks only that a local secret is set, not its strength (env.ts does that).
const SECRET = "change-me-local-secret";

function env(overrides: Partial<DevGateEnv> = {}): DevGateEnv {
  return {
    IDENTITY_PROVIDER: "local",
    NODE_ENV: "development",
    IDENTITY_LOCAL_SECRET: SECRET,
    ...overrides,
  };
}

describe("assertDevBuild (the test-build-only gate)", () => {
  it("opens under the local provider outside production, returning the local secret", () => {
    expect(assertDevBuild(env())).toBe(SECRET);
    expect(assertDevBuild(env({ NODE_ENV: "test" }))).toBe(SECRET);
  });

  it("is a 404 (denial equals absence) in production, under Cognito, or without the secret", () => {
    for (const closed of [
      env({ NODE_ENV: "production" }),
      env({ IDENTITY_PROVIDER: "cognito" }),
      env({ IDENTITY_LOCAL_SECRET: undefined }),
    ]) {
      expect(() => assertDevBuild(closed)).toThrow(expect.objectContaining({ code: "not_found" }));
    }
  });
});
