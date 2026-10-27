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

  it("§1 line 51, §5.14 line 305: a PM who is also Sales keeps Sales's own access links", () => {
    const key = "documents.expiring_access_links.create";
    expect(decide(staff(["SM"]), key, { projectId: "p-9", ownerId: "u-1" }).allowed).toBe(true);
    expect(decide(staff(["PM", "SM"]), key, { projectId: "p-9", ownerId: "u-1" })).toMatchObject({
      allowed: true,
      scope: "own",
    });
  });
});
