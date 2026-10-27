import { resolveClientEntitlements } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import type { ClientPrincipal } from "../../policy/principal.types.js";
import { MeService } from "./me.service.js";

const onHold = resolveClientEntitlements({
  isDemo: false,
  suspended: false,
  subscription: "none",
  hotelAssistanceAgreement: false,
  project: "on_hold",
});

const client: ClientPrincipal = {
  type: "client",
  userId: "0192f3a0-7d3e-7b1a-9c2f-000000000002",
  name: "Meera",
  email: "client@example.com",
  phone: null,
  status: "active",
  lastLoginAt: null,
  memberships: [],
  entitlements: onHold,
};

describe("MeService", () => {
  it("permission-matrix §3 line 100: /me tells an on-hold member what is read-only and how far it reaches", () => {
    const { entitlements } = new MeService().view(client);
    expect(entitlements.readOnlyModules).toContain("wedding_workspace");
    expect(entitlements.readOnlyModules).not.toContain("support");
    expect(entitlements.hotelReach).toEqual(["project_hotels"]);
    expect(entitlements.financeReach).toEqual([]);
    expect(entitlements).toEqual({
      modules: onHold.modules,
      readOnlyModules: onHold.readOnlyModules,
      hotelReach: onHold.hotelReach,
      financeReach: onHold.financeReach,
      requestTypes: onHold.requestTypes,
    });
  });
});
