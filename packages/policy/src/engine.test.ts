import { describe, expect, it } from "vitest";

import {
  can,
  clientReach,
  decide,
  grantsForRole,
  parsePermissionKey,
  permissionKey,
  permissionKeysForRole,
} from "./engine";

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
    expect(grantsForRole("SM").get("admin.staff_users.read")).toBe("all");
    expect(grantsForRole("SM").has("admin.staff_users.update")).toBe(false);
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
});

describe("client reach", () => {
  it("reads the §6 column for a resource", () => {
    const reach = clientReach("client", "Hotel proposals, client amounts");
    expect(reach.flatMap((g) => g.actions)).toEqual(expect.arrayContaining(["read", "approve"]));
    expect(clientReach("guest", "Hotel proposals, client amounts")).toEqual([]);
  });
});
