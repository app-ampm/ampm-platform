/**
 * Golden cases for decide(): every expected value is copied from docs/permission-matrix.md (section
 * and line in the test name), never read from matrix.json, so a parse that drifts from the document
 * fails here even when the generated suite agrees with the parse. Keys follow resources.ts: the
 * curated name, or the slug of the row label.
 */
import { describe, expect, it } from "vitest";

import { decide, type PolicyPrincipal } from "./engine";
import type { StaffRole } from "./roles";

function staff(roles: readonly StaffRole[], extra: Partial<PolicyPrincipal> = {}): PolicyPrincipal {
  return { type: "staff", userId: "u-1", roles, projectIds: ["p-1"], ...extra };
}

describe("§5.10 identity documents (P-5)", () => {
  const key = "guests.identity_documents.read";

  it("§5.10 line 264, P-5 line 21: RG reads identity documents only with an explicit grant on that wedding", () => {
    expect(decide(staff(["RG"]), key, { projectId: "p-1" })).toMatchObject({
      allowed: false,
      reason: "condition_unmet",
    });
    const granted = staff(["RG"], { explicitGrants: [{ key, projectId: "p-1" }] });
    expect(decide(granted, key, { projectId: "p-1" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    const elsewhere = staff(["RG"], { explicitGrants: [{ key, projectId: "p-2" }] });
    expect(decide(elsewhere, key, { projectId: "p-1" }).allowed).toBe(false);
  });

  it("§10 lines 547-548, P-5 line 21: an explicit grant counts however §10 spells its key", () => {
    for (const spelling of [
      "guests.identity_documents.read:assigned",
      "guests.family_groups_guests_standard.read_identity",
    ]) {
      const granted = staff(["RG"], { explicitGrants: [{ key: spelling, projectId: "p-1" }] });
      expect(decide(granted, key, { projectId: "p-1" }), spelling).toMatchObject({
        allowed: true,
        scope: "assigned",
      });
    }
  });

  it("P-5 line 21, §5.10 line 264: RG's upload and edit need their own explicit grant (fail closed)", () => {
    // The document names only the read grant; whether it also opens C and U of the cell is open
    // for AMPM. Until then each action of the cell needs an explicit grant of its own key.
    const create = "guests.identity_documents.create";
    const readOnly = staff(["RG"], { explicitGrants: [{ key, projectId: "p-1" }] });
    expect(decide(readOnly, create, { projectId: "p-1" }).reason).toBe("condition_unmet");
    const uploader = staff(["RG"], { explicitGrants: [{ key: create, projectId: "p-1" }] });
    expect(decide(uploader, create, { projectId: "p-1" }).allowed).toBe(true);
  });

  it("§5.10 line 264: HL reads identity documents on assigned weddings at check-in only", () => {
    expect(decide(staff(["HL"]), key, { projectId: "p-1" }).reason).toBe("condition_unmet");
    expect(decide(staff(["HL"]), key, { projectId: "p-1", checks: ["check_in"] })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(staff(["HL"]), key, { projectId: "p-2", checks: ["check_in"] }).reason).toBe(
      "not_assigned",
    );
  });

  it("§5.10 line 264, §10 line 548: the Super Admin reads identity documents by break-glass only", () => {
    expect(decide(staff(["SA"]), key).reason).toBe("condition_unmet");
    expect(decide(staff(["SA"]), key, { checks: ["break_glass"] })).toMatchObject({
      allowed: true,
      scope: "all",
    });
  });

  it("§5.10 line 264, P-5 line 21: Finance, Sales, Creative and Vendor Coordinators never read them", () => {
    for (const role of ["FA", "SM", "CD", "VC"] as const) {
      expect(decide(staff([role]), key, { projectId: "p-1", checks: ["check_in"] }).reason).toBe(
        "no_grant",
      );
    }
  });
});

describe("§5.7 internal cost", () => {
  const read = "budget.budget_lines_internal_cost.read";

  it("§5.7 line 216, §4 line 123: HT reads internal cost on hotel lines only", () => {
    expect(decide(staff(["HT"]), read).reason).toBe("condition_unmet");
    expect(decide(staff(["HT"]), read, { side: "vendor" }).reason).toBe("condition_unmet");
    expect(decide(staff(["HT"]), read, { side: "hotel" })).toMatchObject({
      allowed: true,
      scope: "all",
    });
  });

  it("§5.7 lines 216 and 220, §4 line 123: a target that names the vendor side never opens a hotel-side grant", () => {
    // "hotel-side values" only: a list of hotel and vendor lines, or a record described as both,
    // is not a hotel line. The side is one value; record types are not sides.
    const mixed = { subjects: ["hotel", "vendor"] } as const;
    expect(decide(staff(["HT"]), read, mixed).allowed).toBe(false);
    const contracts = "budget.contracts_vendors_hotels.update";
    expect(decide(staff(["HT"]), contracts, mixed).allowed).toBe(false);
    expect(decide(staff(["HT"]), contracts, { side: "hotel" }).allowed).toBe(true);
    expect(decide(staff(["HT"]), contracts, { side: "vendor" }).allowed).toBe(false);
  });

  it("§5.7 line 216, §10 line 544: Finance and the Super Admin read internal cost everywhere", () => {
    expect(decide(staff(["FA"]), read)).toMatchObject({ allowed: true, scope: "all" });
    expect(decide(staff(["SA"]), read)).toMatchObject({ allowed: true, scope: "all" });
  });

  it("§5.7 line 216: VC updates internal cost on vendor lines of assigned weddings only", () => {
    const update = "budget.budget_lines_internal_cost.update";
    const vc = staff(["VC"]);
    expect(decide(vc, update, { projectId: "p-1", side: "vendor" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(vc, update, { projectId: "p-1", side: "hotel" }).reason).toBe("condition_unmet");
    expect(decide(vc, update, { projectId: "p-2", side: "vendor" }).reason).toBe("not_assigned");
  });
});

describe("§5.1 administration notes", () => {
  it("§5.1 line 146: Finance reads the audit log of finance entities only", () => {
    expect(decide(staff(["FA"]), "admin.audit_log.read").reason).toBe("condition_unmet");
    expect(
      decide(staff(["FA"]), "admin.audit_log.read", { subjects: ["finance_entity"] }),
    ).toMatchObject({ allowed: true, scope: "all" });
    // Every subject the target names must be one the grant names: guest events stay closed.
    expect(
      decide(staff(["FA"]), "admin.audit_log.read", { subjects: ["finance_entity", "guest"] })
        .reason,
    ).toBe("condition_unmet");
  });

  it("§5.1 line 147: HT imports hotels only and RG imports guests on assigned weddings", () => {
    const key = "admin.import_jobs.create";
    expect(decide(staff(["HT"]), key, { subjects: ["hotel"] }).allowed).toBe(true);
    expect(decide(staff(["HT"]), key, { subjects: ["guest"] }).reason).toBe("condition_unmet");
    expect(decide(staff(["RG"]), key, { projectId: "p-1", subjects: ["guest"] })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
  });
});

describe("§5.6 and §5.15 field and precondition notes", () => {
  it("§5.6 line 203: Creative updates only a function's theme and dress code", () => {
    const key = "functions.functions.update";
    const cd = staff(["CD"]);
    expect(decide(cd, key, { projectId: "p-1", fields: ["theme", "dress_code"] })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(cd, key, { projectId: "p-1", fields: ["status"] }).reason).toBe(
      "condition_unmet",
    );
    expect(decide(cd, key, { projectId: "p-1" }).reason).toBe("condition_unmet");
  });

  it("§5.15 line 312: a PM closes a project only when the checklist and final accounts are done", () => {
    const key = "closure.close_project.approve";
    expect(decide(staff(["PM"]), key, { projectId: "p-1" }).reason).toBe("condition_unmet");
    expect(
      decide(staff(["PM"]), key, { projectId: "p-1", checks: ["closure_ready"] }),
    ).toMatchObject({ allowed: true, scope: "assigned" });
    expect(decide(staff(["SA"]), key)).toMatchObject({ allowed: true, scope: "all" });
    expect(decide(staff(["FA"]), key, { checks: ["closure_ready"] }).reason).toBe("no_grant");
  });

  it("§5.6 line 207, §0a line 37: only the Super Admin authorises a readiness exception", () => {
    const key = "functions.readiness_exceptions.approve";
    expect(decide(staff(["SA"]), key)).toMatchObject({ allowed: true, scope: "all" });
    expect(decide(staff(["PM"]), key, { projectId: "p-1" }).reason).toBe("no_grant");
  });
});

describe("§5.9 internal comments (POL-19)", () => {
  it("§5.9 line 248: SM, HT and FA edit and delete only their own internal comments", () => {
    for (const role of ["SM", "HT", "FA"] as const) {
      for (const action of ["update", "delete"]) {
        const key = `creative.comments_internal.${action}`;
        expect(decide(staff([role]), key, { ownerId: "u-2" }).reason).toBe("not_owner");
        expect(decide(staff([role]), key, { ownerId: "u-1" })).toMatchObject({
          allowed: true,
          scope: "own",
        });
      }
    }
  });
});

describe("§1 layer 2: a principal's permissions are the union of its roles", () => {
  it("§1 line 51, §5.13 line 293: a PM who is also Finance keeps Finance's own tasks", () => {
    const pmFa = staff(["PM", "FA"]);
    expect(decide(pmFa, "tasks.tasks.read", { projectId: "p-9", ownerId: "u-1" })).toMatchObject({
      allowed: true,
      scope: "own",
    });
    expect(decide(pmFa, "tasks.tasks.read", { ownerId: "u-1" })).toMatchObject({
      allowed: true,
      scope: "own",
    });
    expect(decide(pmFa, "tasks.tasks.read", { projectId: "p-1", ownerId: "u-2" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(pmFa, "tasks.tasks.read", { projectId: "p-9", ownerId: "u-2" }).allowed).toBe(
      false,
    );
  });

  it("§1 line 51, §5.6 line 203: Creative and Hospitality together update theme and logistics notes at once", () => {
    const key = "functions.functions.update";
    const cdHl = staff(["CD", "HL"]);
    const both = { projectId: "p-1", fields: ["theme", "logistics_notes"] } as const;
    expect(decide(cdHl, key, both)).toMatchObject({ allowed: true, scope: "assigned" });
    expect(decide(staff(["CD"]), key, both).reason).toBe("condition_unmet");
    expect(decide(staff(["HL"]), key, both).reason).toBe("condition_unmet");
    // A field neither role is given stays closed, and so does another wedding.
    const extra = { projectId: "p-1", fields: ["theme", "status"] } as const;
    expect(decide(cdHl, key, extra).reason).toBe("condition_unmet");
    expect(decide(cdHl, key, { ...both, projectId: "p-2" }).allowed).toBe(false);
  });

  it("§1 line 51, §5.9 line 251: subjects granted by different roles combine too, at the narrower scope", () => {
    const key = "creative.approvals_submit_for_decision.create";
    const target = { projectId: "p-1", subjects: ["hotel_proposal", "design"] } as const;
    expect(decide(staff(["HT", "CD"]), key, target)).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(staff(["HT"]), key, target).allowed).toBe(false);
    expect(decide(staff(["HT", "CD"]), key, { ...target, projectId: "p-2" }).allowed).toBe(false);
  });

  it("§1 line 51, §5.14 line 305: a PM who is also Sales keeps Sales's own access links", () => {
    const key = "documents.expiring_access_links.create";
    expect(decide(staff(["SM"]), key, { projectId: "p-9", ownerId: "u-1" }).allowed).toBe(true);
    expect(decide(staff(["PM", "SM"]), key, { projectId: "p-9", ownerId: "u-1" })).toMatchObject({
      allowed: true,
      scope: "own",
    });
  });
});
