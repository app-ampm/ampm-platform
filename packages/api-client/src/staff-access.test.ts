import type { MeResponse } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { staffAccessFor, staffRoleNames } from "./staff-access";

type Me = Pick<MeResponse, "principal" | "roles" | "customCapabilities">;

function me(
  type: Me["principal"]["type"],
  roles: Me["roles"],
  customCapabilities: string[] = [],
): Me {
  return {
    principal: {
      type,
      userId: "018f0000-0000-7000-8000-00000000cafe",
      name: "Cyra Custom",
      email: "cyra@example.com",
      phone: null,
      status: "active",
      lastLoginAt: null,
    },
    roles,
    customCapabilities,
  };
}

describe("staffAccessFor (D-164)", () => {
  it("lets a custom role do what its capabilities grant, with no system role", () => {
    const access = staffAccessFor(
      me("staff", [], ["crm.accounts.update:all", "crm.leads.read:all"]),
    );
    expect(access.can("crm.accounts.update")).toBe(true);
    expect(access.holds("crm.leads.read")).toBe(true);
    expect(access.can("crm.accounts.create")).toBe(false);
  });

  it("still decides a system role from the matrix", () => {
    const access = staffAccessFor(me("staff", ["SM"]));
    expect(access.can("crm.leads.update")).toBe(true);
    expect(access.can("admin.staff_users.update")).toBe(false);
  });

  it("keeps the two rules apart: can() needs every record, holds() any scope", () => {
    // A project manager updates the accounts of their own weddings only.
    const access = staffAccessFor(me("staff", ["PM"]));
    expect(access.holds("crm.accounts.update")).toBe(true);
    expect(access.can("crm.accounts.update")).toBe(false);
  });

  it("grants nothing before /me answers, or to anyone who is not staff", () => {
    expect(staffAccessFor(undefined).holds("crm.leads.read")).toBe(false);
    const client = staffAccessFor(me("client", [], ["crm.leads.read:all"]));
    expect(client.can("crm.leads.read")).toBe(false);
    expect(client.holds("crm.leads.read")).toBe(false);
  });

  it("names the system roles, then the custom roles, never a custom role's key", () => {
    const names = staffRoleNames({
      roles: ["FA"],
      customRoles: [{ key: "custom_17f1e5aa", name: "Sales assistant" }],
    });
    expect(names).toEqual([
      { key: "FA", name: "Finance / Accounts" },
      { key: "custom_17f1e5aa", name: "Sales assistant" },
    ]);
  });
});
