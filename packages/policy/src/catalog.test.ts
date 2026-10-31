import { describe, expect, it } from "vitest";

import {
  assignableCapabilities,
  capabilityById,
  GRANTABLE_CAPABILITIES,
  resolveCustomGrants,
} from "./capabilities";
import {
  buildGrantableCapabilities,
  capabilityId,
  conditionSignature,
  isEscalationLocked,
} from "./catalog";
import { decide, grantsForRole, type PolicyPrincipal } from "./engine";
import committed from "./generated/capabilities.json" with { type: "json" };
import { MATRIX } from "./matrix";

describe("the capability catalog", () => {
  it("builds from the matrix deterministically, with unique ids", () => {
    const built = buildGrantableCapabilities(MATRIX.staff);
    expect(built.length).toBeGreaterThan(0);
    expect(built).toEqual(buildGrantableCapabilities(MATRIX.staff));
    expect(new Set(built.map((capability) => capability.id)).size).toBe(built.length);
    expect(GRANTABLE_CAPABILITIES).toEqual(built);
  });

  it("matches the committed src/generated/capabilities.json (drift guard)", () => {
    expect(committed).toEqual(buildGrantableCapabilities(MATRIX.staff));
  });

  it("every capability is a grant a system role actually holds (subset of the matrix)", () => {
    for (const capability of GRANTABLE_CAPABILITIES) {
      expect(capability.sourceRoles.length).toBeGreaterThan(0);
      const base = `${capability.module}.${capability.resource}.${capability.action}`;
      const grant = { scope: capability.scope, conditions: capability.conditions };
      for (const role of capability.sourceRoles) {
        expect(grantsForRole(role).get(base) ?? []).toContainEqual(grant);
      }
    }
  });

  it("locks role/account administration and identity, leaving ordinary resources assignable", () => {
    expect(isEscalationLocked("admin", "roles")).toBe(true);
    expect(isEscalationLocked("admin", "staff_users")).toBe(true);
    expect(isEscalationLocked("admin", "client_logins")).toBe(true);
    expect(isEscalationLocked("guests", "identity_documents")).toBe(true);
    expect(isEscalationLocked("tasks", "tasks")).toBe(false);

    const assignable = assignableCapabilities();
    expect(assignable.every((capability) => !capability.isEscalationLocked)).toBe(true);
    expect(assignable.length).toBeLessThan(GRANTABLE_CAPABILITIES.length);
    expect(GRANTABLE_CAPABILITIES.every((capability) => capability.isStaffOnly)).toBe(true);
  });
});

describe("conditionSignature and capabilityId", () => {
  it("are order-independent and stable", () => {
    expect(conditionSignature([{ kind: "side", anyOf: ["vendor", "hotel"] }])).toBe(
      conditionSignature([{ kind: "side", anyOf: ["hotel", "vendor"] }]),
    );
    expect(capabilityId("tasks", "tasks", "read", "all", [])).toBe("tasks.tasks.read:all");
    expect(
      capabilityId("budget", "lines", "read", "all", [{ kind: "side", anyOf: ["hotel"] }]),
    ).toBe("budget.lines.read:all#side:hotel");
  });
});

describe("resolveCustomGrants", () => {
  it("compiles known assignable ids and rejects unknown ones, fail-closed", () => {
    const capability = assignableCapabilities()[0];
    expect(capability).toBeDefined();
    if (!capability) return;
    const base = `${capability.module}.${capability.resource}.${capability.action}`;

    const resolved = resolveCustomGrants([capability.id, "nope.not.real:all"]);
    expect(resolved.grants.get(base) ?? []).toContainEqual({
      scope: capability.scope,
      conditions: capability.conditions,
    });
    expect(resolved.derivedRoles.length).toBeGreaterThan(0);
    expect(resolved.rejected).toContain("nope.not.real:all");
  });

  it("refuses an escalation-locked capability (never enforced)", () => {
    const locked = GRANTABLE_CAPABILITIES.find((capability) => capability.isEscalationLocked);
    expect(locked).toBeDefined();
    if (!locked) return;
    expect(capabilityById(locked.id)).toEqual(locked);

    const resolved = resolveCustomGrants([locked.id]);
    expect(resolved.rejected).toContain(locked.id);
    expect(resolved.grants.size).toBe(0);
  });
});

describe("resolvedGrants in decide()", () => {
  it("enforces a custom grant for a staff principal, and never for a non-staff one", () => {
    const simple = assignableCapabilities().find(
      (capability) => capability.scope === "all" && capability.conditions.length === 0,
    );
    expect(simple).toBeDefined();
    if (!simple) return;
    const base = `${simple.module}.${simple.resource}.${simple.action}`;
    const { grants } = resolveCustomGrants([simple.id]);

    const staff: PolicyPrincipal = {
      type: "staff",
      userId: "u1",
      roles: [],
      resolvedGrants: grants,
    };
    expect(decide(staff, base, { projectId: "p1" }).allowed).toBe(true);

    // Ceiling: the same resolved grants can never elevate a non-staff principal.
    const client: PolicyPrincipal = { type: "client", userId: "c1", resolvedGrants: grants };
    expect(decide(client, base, { projectId: "p1" }).reason).toBe("not_staff");

    // Without any role or resolved grant, the same staff principal holds nothing on that key.
    const bare: PolicyPrincipal = { type: "staff", userId: "u1", roles: [] };
    expect(decide(bare, base, { projectId: "p1" }).allowed).toBe(false);
  });
});
