/**
 * Golden cases for the §10 key vocabulary: the class-specific reads and the two verbs §10 names are
 * keys, and each resolves to the §5 row that holds that class or decision (values from
 * docs/permission-matrix.md, line in the test name).
 */
import { describe, expect, it } from "vitest";

import { decide, type PolicyPrincipal } from "./engine";
import { parsePermissionKey } from "./keys";
import type { StaffRole } from "./roles";

function staff(roles: readonly StaffRole[], extra: Partial<PolicyPrincipal> = {}): PolicyPrincipal {
  return { type: "staff", userId: "u-1", roles, projectIds: ["p-1"], ...extra };
}

describe("§10 permission keys", () => {
  it("§10 line 533: class-specific reads and the §10 verbs parse as keys", () => {
    expect(parsePermissionKey("budget.lines.read_internal_cost")).toEqual({
      module: "budget",
      resource: "lines",
      action: "read_internal_cost",
      scope: "all",
    });
    for (const action of [
      "read_internal_notes",
      "read_contacts",
      "read_sensitive",
      "read_identity",
      "read_internal_amount",
    ]) {
      expect(parsePermissionKey(`guests.guests.${action}:assigned`)?.action).toBe(action);
    }
    expect(parsePermissionKey("functions.readiness.authorise_exception:assigned")).toMatchObject({
      action: "authorise_exception",
      scope: "assigned",
    });
    expect(parsePermissionKey("approvals.decisions.create_on_behalf:assigned")?.action).toBe(
      "create_on_behalf",
    );
    expect(parsePermissionKey("budget.lines.read_everything")).toBeNull();
  });

  it("§10 lines 543-544, §5.7 line 216: read_internal_cost on budget lines reads the internal-cost row", () => {
    const key = "budget.budget_lines_client_facing.read_internal_cost";
    expect(decide(staff(["FA"]), key)).toMatchObject({ allowed: true, scope: "all" });
    expect(decide(staff(["PM"]), key, { projectId: "p-1" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(staff(["CD"]), key, { projectId: "p-1" }).reason).toBe("no_grant");
    expect(decide(staff(["HT"]), key).reason).toBe("condition_unmet");
  });

  it("§10 line 547, §5.10 line 264: read_identity on guests needs RG's explicit grant", () => {
    const key = "guests.family_groups_guests_standard.read_identity";
    expect(decide(staff(["RG"]), key, { projectId: "p-1" }).reason).toBe("condition_unmet");
    const explicitGrants = [{ key: "guests.identity_documents.read", projectId: "p-1" }];
    expect(decide(staff(["RG"], { explicitGrants }), key, { projectId: "p-1" }).allowed).toBe(true);
  });

  it("§10 lines 546 and 550, §5.9 line 252, §5.6 line 207: the §10 verbs name their rows' decisions", () => {
    const onBehalf = "creative.approval_decisions_on_client.create_on_behalf";
    expect(decide(staff(["PM"]), onBehalf, { projectId: "p-1" }).allowed).toBe(true);
    expect(decide(staff(["CD"]), onBehalf, { projectId: "p-1" }).reason).toBe("no_grant");
    const exception = "functions.readiness_exceptions.authorise_exception";
    expect(decide(staff(["SA"]), exception).allowed).toBe(true);
    expect(decide(staff(["PM"]), exception, { projectId: "p-1" }).reason).toBe("no_grant");
  });
});
