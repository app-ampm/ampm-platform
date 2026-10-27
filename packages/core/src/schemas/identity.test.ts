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
      entitlements: {
        modules: [],
        readOnlyModules: [],
        hotelReach: [],
        financeReach: [],
        requestTypes: { wedding: [], account: [] },
      },
      isDemo: false,
    });
    expect(parsed.principal).not.toHaveProperty("passwordHash");
    expect(parsed.roles).toEqual(["SA"]);
  });

  it("keeps how far each module reaches, so /me says what the policy resolved (§3)", () => {
    const entitlements = {
      modules: ["wedding_workspace", "client_finance", "support"],
      readOnlyModules: ["wedding_workspace", "client_finance"],
      hotelReach: ["project_hotels"],
      financeReach: ["own_invoices"],
      requestTypes: { wedding: ["support"], account: [] },
    };
    const parsed = meResponse.parse({
      principal: {
        type: "client",
        userId: "0192f3a0-7d3e-7b1a-9c2f-123456789abc",
        name: "Meera",
        email: null,
        phone: null,
        status: "active",
        lastLoginAt: null,
      },
      roles: [],
      memberships: [],
      entitlements,
      isDemo: false,
    });
    expect(parsed.entitlements).toEqual(entitlements);
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
        entitlements: {
          modules: [],
          readOnlyModules: [],
          hotelReach: [],
          financeReach: [],
          requestTypes: { wedding: [], account: [] },
        },
        isDemo: false,
      }),
    ).toThrow();
  });
});
