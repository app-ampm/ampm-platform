import { describe, expect, it } from "vitest";

import { meResponse } from "./identity";

describe("meResponse", () => {
  it("accepts a staff principal and strips unknown fields", () => {
    const parsed = meResponse.parse({
      principal: {
        type: "staff",
        userId: "0192f3a0-7d3e-7b1a-9c2f-123456789abc",
        name: "Asha",
        email: "asha@example.com",
        phone: null,
        status: "active",
        lastLoginAt: null,
        passwordHash: "never",
      },
      roles: ["SA"],
      memberships: [],
      entitlements: { modules: [] },
      isDemo: false,
    });
    expect(parsed.principal).not.toHaveProperty("passwordHash");
    expect(parsed.roles).toEqual(["SA"]);
  });

  it("rejects an unknown role code", () => {
    expect(() =>
      meResponse.parse({
        principal: {
          type: "staff",
          userId: "0192f3a0-7d3e-7b1a-9c2f-123456789abc",
          name: "A",
          email: null,
          phone: null,
          status: "active",
          lastLoginAt: null,
        },
        roles: ["XX"],
        memberships: [],
        entitlements: { modules: [] },
        isDemo: false,
      }),
    ).toThrow();
  });
});
