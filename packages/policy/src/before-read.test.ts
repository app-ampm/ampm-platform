/**
 * Golden cases for what the guard decides before any record is read (architecture §6 step 4), and
 * for record visibility (permission-matrix §1 layer 5). Expected values come from the document.
 */
import { describe, expect, it } from "vitest";

import { admittedVisibilities } from "./classes";
import { decide, decideBeforeRead, readKeyFor } from "./engine";

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

  it("§5 legend line 136, §5.13 line 293: an owner the caller names is decided as named", () => {
    // "(o)" reaches records the user created or owns: Bob's task is not FA's, whoever asks.
    expect(
      decideBeforeRead(fa, "tasks.tasks.update", { projectId: "p-1", ownerId: "u-bob" }),
    ).toMatchObject({ allowed: false, reason: "not_owner" });
    expect(
      decideBeforeRead(fa, "tasks.tasks.update", { projectId: "p-1", ownerId: "u-fa" }),
    ).toMatchObject({ allowed: true, scope: "own" });
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

  it("test-cases.md line 212: a class of a record's columns reads through the record's row", () => {
    // §5.7 line 216 is the internal cost columns of the budget lines of line 215.
    expect(readKeyFor("budget.budget_lines_client_facing.read_internal_cost")).toBe(
      "budget.budget_lines_client_facing.read",
    );
    expect(readKeyFor("budget.budget_lines_internal_cost.update")).toBe(
      "budget.budget_lines_client_facing.read",
    );
    // §5.8 line 231 and §5.3 line 169: columns of the vendor and hotel profiles (lines 230, 168).
    expect(readKeyFor("vendors.vendor_profiles_client_fields.read_contacts")).toBe(
      "vendors.vendor_profiles_client_fields.read",
    );
    expect(readKeyFor("hotels.hotel_profiles_client_fields.read_internal_notes")).toBe(
      "hotels.hotel_profiles_client_fields.read",
    );
  });

  it("data-model.md §19 lines 1949 and 2002: a class kept in a table of its own reads its own row", () => {
    // AC-10.9 (test-cases.md line 801): RG (a) without the grant gets 404 on the identity route.
    expect(readKeyFor("guests.identity_documents.read:assigned")).toBe(
      "guests.identity_documents.read",
    );
    expect(readKeyFor("hotels.hotel_profiles_client_fields.read_contacts")).toBe(
      "hotels.hotel_contacts.read",
    );
  });

  it("a decision row no role reads names the read of the record it acts on", () => {
    const readiness = "functions.readiness_checklist_items.read";
    expect(readKeyFor("functions.readiness_exceptions.authorise_exception")).toBe(readiness);
    expect(readKeyFor("functions.readiness_exceptions.approve")).toBe(readiness);
    expect(readKeyFor("functions.function_status.update:assigned")).toBe(
      "functions.functions.read",
    );
    expect(readKeyFor("approvals.decisions.create_on_behalf:assigned")).toBe(
      "creative.approvals_submit_for_decision.read",
    );
    expect(readKeyFor("documents.set_client_visibility_on.share")).toBe(
      "documents.documents_on_records_role.read",
    );
    expect(readKeyFor("projects.close:assigned")).toBe("projects.wedding_projects.read");
    expect(readKeyFor("closure.archive_project_after_window.approve")).toBe(
      "projects.wedding_projects.read",
    );
    // §5.15 line 314: the retention job's proposal (§8 line 507) is no one row's record.
    expect(readKeyFor("closure.approve_retention_deletion_proposed.approve")).toBeNull();
  });
});

describe("§10 line 550: functions.readiness.authorise_exception as the document spells it", () => {
  const key = "functions.readiness.authorise_exception:assigned";
  const hl = { type: "staff", userId: "u-hl", roles: ["HL"], projectIds: ["p-1"] } as const;

  it("reads through the readiness checklist items it acts on (§5.6 lines 206-207)", () => {
    expect(readKeyFor(key)).toBe("functions.readiness_checklist_items.read");
    expect(readKeyFor("functions.readiness.authorise_exception")).toBe(
      "functions.readiness_checklist_items.read",
    );
  });

  it("§5.6 line 207 (Q10), AC-13.2: SA authorises; PM and HL hold no grant", () => {
    expect(
      decide(sa, "functions.readiness.authorise_exception", { projectId: "p-1" }),
    ).toMatchObject({
      allowed: true,
      scope: "all",
    });
    expect(decide(pm, key, { projectId: "p-1" }).reason).toBe("no_grant");
    expect(decide(hl, key, { projectId: "p-1" }).reason).toBe("no_grant");
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
