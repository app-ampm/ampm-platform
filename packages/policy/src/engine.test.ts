import { describe, expect, it } from "vitest";

import { can, decide, grantsForRole, permissionKeysForRole } from "./engine";
import { parsePermissionKey, permissionKey } from "./keys";
import { clientReach, decideReach } from "./reach";

const sa = { type: "staff", userId: "u-sa", roles: ["SA"] } as const;
const sm = { type: "staff", userId: "u-sm", roles: ["SM"] } as const;
const pm = { type: "staff", userId: "u-pm", roles: ["PM"], projectIds: ["p-1"] } as const;

describe("permission keys", () => {
  it("composes and parses keys with scopes", () => {
    expect(permissionKey("admin", "staff_users", "read")).toBe("admin.staff_users.read");
    expect(permissionKey("projects", "members", "update", "assigned")).toBe(
      "projects.members.update:assigned",
    );
    expect(parsePermissionKey("budget.lines.read:own")).toEqual({
      module: "budget",
      resource: "lines",
      action: "read",
      scope: "own",
    });
    expect(parsePermissionKey("nonsense")).toBeNull();
  });

  it("gives the Super Admin every administration action and Sales read only", () => {
    const saKeys = permissionKeysForRole("SA");
    for (const action of ["create", "read", "update", "delete"])
      expect(saKeys).toContain(`admin.staff_users.${action}`);
    expect(grantsForRole("SM").get("admin.staff_users.read")).toEqual([
      { scope: "all", conditions: [] },
    ]);
    expect(grantsForRole("SM").has("admin.staff_users.update")).toBe(false);
  });

  it("leaves conditioned grants out of the keys a role holds outright (§5.10 line 264)", () => {
    expect(permissionKeysForRole("RG")).not.toContain("guests.identity_documents.read:assigned");
    expect(permissionKeysForRole("HL")).not.toContain("guests.identity_documents.read:assigned");
    expect(permissionKeysForRole("HT")).not.toContain("budget.budget_lines_internal_cost.read");
    expect(permissionKeysForRole("FA")).toContain("budget.budget_lines_internal_cost.read");
    expect(permissionKeysForRole("FA")).toContain("reports.budget_internal.export");
  });
});

describe("decide", () => {
  it("grants, denies and explains", () => {
    expect(can(sa, "admin.roles.update")).toBe(true);
    expect(decide(sm, "admin.roles.update")).toEqual({ allowed: false, reason: "no_grant" });
    expect(decide({ type: "client" }, "admin.roles.read")).toEqual({
      allowed: false,
      reason: "not_staff",
    });
    expect(decide({ type: "system" }, "anything.at.all").allowed).toBe(true);
  });

  it("limits assigned roles to their projects", () => {
    expect(decide(pm, "admin.client_logins.update", { projectId: "p-1" })).toEqual({
      allowed: true,
      scope: "assigned",
      reason: "granted",
    });
    expect(decide(pm, "admin.client_logins.update", { projectId: "p-2" }).reason).toBe(
      "not_assigned",
    );
    expect(decide(pm, "admin.client_logins.update").reason).toBe("not_assigned");
  });

  it("limits own-record grants to the owner", () => {
    expect(decide(sm, "admin.notifications.read", { ownerId: "u-sm" }).allowed).toBe(true);
    expect(decide(sm, "admin.notifications.read", { ownerId: "u-other" }).reason).toBe("not_owner");
  });

  it("names the unmet conditions so the caller knows what to establish", () => {
    expect(decide(sm, "hotels.hotel_media_rights_status.update")).toEqual({
      allowed: false,
      reason: "condition_unmet",
      unmet: [{ kind: "fields", only: ["rights"] }],
    });
  });
});

describe("client reach", () => {
  it("reads the §6 column for a resource, by label or slug", () => {
    const reach = clientReach("client", "Hotel proposals, client amounts");
    expect(reach.flatMap((g) => g.actions)).toEqual(expect.arrayContaining(["read", "approve"]));
    expect(clientReach("client", "hotel_proposals_client_amounts")).toEqual(reach);
    expect(clientReach("guest", "Hotel proposals, client amounts")).toEqual([]);
  });

  it("§6 line 345: a representative updates the client feedback only", () => {
    expect(decideReach("client", "enquiry_status_non_internal", "read").allowed).toBe(true);
    expect(decideReach("client", "enquiry_status_non_internal", "update").reason).toBe(
      "condition_unmet",
    );
    expect(
      decideReach("client", "enquiry_status_non_internal", "update", { fields: ["feedback"] }),
    ).toMatchObject({ allowed: true, scope: "own" });
  });

  it("§6 lines 344 and 362: the demo's creations go to Sales and its reads are sample data", () => {
    expect(decideReach("demo", "hotel_assistance_requests", "create").reason).toBe(
      "condition_unmet",
    );
    expect(
      decideReach("demo", "hotel_assistance_requests", "create", { checks: ["routed_to_sales"] })
        .allowed,
    ).toBe(true);
    // "R sample": a real record is refused; only a demo or sample record is read.
    expect(decideReach("demo", "attendance_rsvp_progress", "read")).toEqual({
      allowed: false,
      reason: "condition_unmet",
      unmet: [{ kind: "check", check: "demo_record" }],
    });
    expect(
      decideReach("demo", "attendance_rsvp_progress", "read", { checks: ["demo_record"] }),
    ).toMatchObject({ allowed: true, scope: "own" });
    expect(decideReach("demo", "attendance_rsvp_progress", "update").reason).toBe("no_grant");
  });

  it("§6 line 371 and line 359: notification preferences are the principal's own; no sensitive fields", () => {
    expect(decideReach("client", "notification_preferences", "update").allowed).toBe(true);
    expect(decideReach("demo", "notification_preferences", "read").allowed).toBe(true);
    expect(decideReach("client", "guest_sensitive_fields", "read").reason).toBe("no_grant");
  });
});
