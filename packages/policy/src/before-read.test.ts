/**
 * Golden cases for what the guard decides before any record is read (architecture §6 step 4), and
 * for record visibility (permission-matrix §1 layer 5). Expected values come from the document.
 */
import { describe, expect, it } from "vitest";

import { admittedVisibilities } from "./classes";
import { decideBeforeRead, readKeyFor } from "./engine";

const sa = { type: "staff", userId: "u-sa", roles: ["SA"] } as const;
const fa = { type: "staff", userId: "u-fa", roles: ["FA"], projectIds: ["p-1"] } as const;
const pmFa = { type: "staff", userId: "u-pf", roles: ["PM", "FA"], projectIds: ["p-1"] } as const;
const pm = { type: "staff", userId: "u-pm", roles: ["PM"], projectIds: ["p-1"] } as const;
const cd = { type: "staff", userId: "u-cd", roles: ["CD"], projectIds: ["p-1"] } as const;
const client = { type: "client", userId: "u-c", projectIds: ["p-1"] } as const;

describe("decideBeforeRead", () => {
  it("§5 legend line 136, §5.13 lines 293 and 295: an own-scope grant passes as 'own', for the repository to narrow", () => {
    expect(decideBeforeRead(fa, "tasks.tasks.read", { projectId: "p-9" })).toMatchObject({
      allowed: true,
      scope: "own",
    });
    expect(
      decideBeforeRead(cd, "tasks.staff_assignments.read", { projectId: "p-9" }),
    ).toMatchObject({ allowed: true, scope: "own" });
  });

  it("§1 line 51, §5.13 line 293: a role's own scope survives another role's assigned miss", () => {
    expect(decideBeforeRead(pmFa, "tasks.tasks.read", { projectId: "p-9" })).toMatchObject({
      allowed: true,
      scope: "own",
    });
    expect(decideBeforeRead(pmFa, "tasks.tasks.read", { projectId: "p-1" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
  });

  it("§1 line 52, §5.13 line 296: assigned and unscoped grants decide as decide() does", () => {
    expect(decideBeforeRead(pm, "tasks.incidents.read", { projectId: "p-9" })).toMatchObject({
      allowed: false,
      reason: "not_assigned",
    });
    expect(decideBeforeRead(pm, "tasks.incidents.read", { projectId: "p-1" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decideBeforeRead(sa, "tasks.incidents.delete", { projectId: "p-9" })).toMatchObject({
      allowed: true,
      scope: "all",
    });
    expect(decideBeforeRead(cd, "tasks.incidents.update", { projectId: "p-1" })).toMatchObject({
      allowed: false,
      reason: "no_grant",
    });
    expect(decideBeforeRead(client, "tasks.incidents.read", { projectId: "p-1" })).toMatchObject({
      allowed: false,
      reason: "not_staff",
    });
  });
});

describe("readKeyFor", () => {
  it("names the read of the row a key decides on, for telling 403 from 404", () => {
    expect(readKeyFor("tasks.incidents.create")).toBe("tasks.incidents.read");
    expect(readKeyFor("tasks.incidents.update:assigned")).toBe("tasks.incidents.read");
    expect(readKeyFor("tasks.incidents.read")).toBe("tasks.incidents.read");
    // §10 line 547: the class alias reads the identity documents row.
    expect(readKeyFor("guests.family_groups_guests_standard.read_identity")).toBe(
      "guests.identity_documents.read",
    );
    // §10 line 545: a key named from outside its row's subsection.
    expect(readKeyFor("vendors.quotes.read")).toBe("budget.vendor_quotes.read");
    expect(readKeyFor("nonsense")).toBeNull();
    expect(readKeyFor("tasks.unknown_row.read")).toBeNull();
  });
});

describe("admittedVisibilities", () => {
  it("§1 line 54 with data-model.md line 83: each principal reads its own audience and public", () => {
    expect(admittedVisibilities("staff")).toBeNull();
    expect(admittedVisibilities("system")).toBeNull();
    expect(admittedVisibilities("client")).toEqual(["client", "public"]);
    expect(admittedVisibilities("guest")).toEqual(["guest", "public"]);
    expect(admittedVisibilities("demo")).toEqual(["demo", "public"]);
  });
});
