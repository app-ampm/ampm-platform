import type { Membership } from "@ampm/core";
import { STAFF_ROLES, decideBeforeRead, type StaffRole } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import type {
  ClientPrincipal,
  DemoPrincipal,
  StaffPrincipal,
  SystemPrincipal,
} from "../policy/principal.types.js";
import { toPolicyPrincipal } from "../policy/principal.types.js";
import { isInScope, recordScope } from "./scoping.js";

const MEMBER = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const OTHER = "0192f3a0-7d3e-7b1a-9c2f-0000000000b2";
const membership: Membership = {
  projectId: MEMBER,
  projectRole: "staff",
  clientSide: null,
  canViewFinance: false,
  canApprove: false,
};

function staff(roles: StaffRole[]): StaffPrincipal {
  return {
    type: "staff",
    userId: "user-1",
    name: "Staff",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [membership],
    roles,
  };
}

const NO_ENTITLEMENTS = {
  modules: [],
  readOnlyModules: [],
  hotelReach: [],
  financeReach: [],
  requestTypes: { wedding: [], account: [] },
  signInRefused: false,
};
const CLIENT: ClientPrincipal = { ...staff([]), type: "client", entitlements: NO_ENTITLEMENTS };
const DEMO: DemoPrincipal = { ...staff([]), type: "demo", entitlements: NO_ENTITLEMENTS };
const SYSTEM: SystemPrincipal = { type: "system", name: "demo restore job" };

describe("recordScope (architecture §6 step 5)", () => {
  it("staff reach what the grant's scope reaches, and never demo data (A-28)", () => {
    expect(recordScope(staff(["SA"]), "all")).toEqual({
      where: { deletedAt: null },
      isDemo: false,
    });
    expect(recordScope(staff(["PM"]), "assigned")).toEqual({
      where: { projectId: { in: [MEMBER] }, deletedAt: null },
      isDemo: false,
    });
    expect(recordScope(staff(["FA"]), "own")).toEqual({
      where: { deletedAt: null },
      isDemo: false,
      ownerId: "user-1",
    });
  });

  it("§6 line 338 and §1 line 54: clients reach their weddings, through what is addressed to them", () => {
    expect(recordScope(CLIENT, "own")).toEqual({
      where: { projectId: { in: [MEMBER] }, deletedAt: null },
      isDemo: false,
      visibilities: ["client", "public"],
    });
    expect(recordScope(DEMO, "own")).toMatchObject({
      isDemo: true,
      visibilities: ["demo", "public"],
    });
  });

  it("the system is bounded by soft delete only", () => {
    expect(recordScope(SYSTEM, "all")).toEqual({ where: { deletedAt: null } });
  });

  it("CODE-03: the scope comes from the matrix cell, not from the role's 'assigned' flag", () => {
    // §5.13 line 296 gives VC "CR (a)" on incidents, although VC is not an assigned role (§2).
    expect(STAFF_ROLES.VC.assigned).toBe(false);
    const vc = staff(["VC"]);
    const decision = decideBeforeRead(toPolicyPrincipal(vc), "tasks.incidents.read", {
      projectId: MEMBER,
    });
    expect(decision.scope).toBe("assigned");
    const scope = recordScope(vc, decision.scope ?? "assigned");
    expect(isInScope({ projectId: MEMBER }, scope)).toBe(true);
    expect(isInScope({ projectId: OTHER }, scope)).toBe(false);
  });
});

describe("isInScope", () => {
  const assigned = recordScope(staff(["PM"]), "assigned");
  const own = recordScope(staff(["FA"]), "own");
  const client = recordScope(CLIENT, "own");

  it("excludes soft-deleted rows, other weddings and demo rows", () => {
    expect(isInScope({ projectId: MEMBER }, assigned)).toBe(true);
    expect(isInScope({ projectId: MEMBER, deletedAt: new Date() }, assigned)).toBe(false);
    expect(isInScope({ projectId: OTHER }, assigned)).toBe(false);
    expect(isInScope({ projectId: MEMBER, isDemo: true }, assigned)).toBe(false);
  });

  it("narrows own scope to the principal's records on any wedding", () => {
    expect(isInScope({ projectId: OTHER, ownerId: "user-1" }, own)).toBe(true);
    expect(isInScope({ projectId: OTHER, ownerId: "user-2" }, own)).toBe(false);
    expect(isInScope({ projectId: OTHER }, own)).toBe(false);
  });

  it("admits a client only to records whose visibility is addressed to clients or the public", () => {
    expect(isInScope({ projectId: MEMBER, visibility: "client" }, client)).toBe(true);
    expect(isInScope({ projectId: MEMBER, visibility: "public" }, client)).toBe(true);
    expect(isInScope({ projectId: MEMBER, visibility: "internal" }, client)).toBe(false);
    expect(isInScope({ projectId: MEMBER }, client)).toBe(false);
  });
});
