import { describe, expect, it } from "vitest";

import { resolveCustomGrants } from "./capabilities";
import { holdsKey, permissionKeysForRole } from "./engine";
import { MATRIX } from "./matrix";
import { STAFF_ROLE_CODES } from "./roles";

/** Every base key the matrix defines: `module.resource.action`. */
const BASE_KEYS = [
  ...new Set(
    MATRIX.staff.flatMap((row) =>
      Object.values(row.grants)
        .flat()
        .flatMap((grant) => grant.actions.map((a) => `${row.module}.${row.resource}.${a}`)),
    ),
  ),
];

/** The rule the app's areas used before D-164: a role's unconditioned key, as written or with a scope. */
function heldBefore(role: (typeof STAFF_ROLE_CODES)[number], key: string): boolean {
  return permissionKeysForRole(role).some((k) => k === key || k.startsWith(`${key}:`));
}

describe("holdsKey (D-164)", () => {
  it.each(STAFF_ROLE_CODES)(
    "answers for %s exactly as the matrix's unconditioned keys did, for every key",
    (role) => {
      const principal = { type: "staff", roles: [role] } as const;
      for (const key of BASE_KEYS)
        expect([key, holdsKey(principal, key)]).toEqual([key, heldBefore(role, key)]);
    },
  );

  it("counts a grant in any scope, unlike can(), which needs one on every record", () => {
    const pm = { type: "staff", roles: ["PM"] } as const;
    expect(holdsKey(pm, "crm.accounts.update")).toBe(true); // PM: assigned weddings only
  });

  it("counts a custom role's resolved grants, so a staff member with no system role holds them", () => {
    const { grants } = resolveCustomGrants([
      "crm.leads.read:all",
      "consultancy.enquiries.read:all",
    ]);
    const custom = { type: "staff", roles: [], resolvedGrants: grants } as const;
    expect(holdsKey(custom, "crm.leads.read")).toBe(true);
    expect(holdsKey(custom, "consultancy.enquiries.read")).toBe(true);
    expect(holdsKey(custom, "crm.leads.update")).toBe(false);
  });

  it("leaves out a conditioned grant, which only decide() can evaluate against a target", () => {
    const { grants } = resolveCustomGrants(["crm.accounts.read:all#fields:billing"]);
    expect(
      holdsKey({ type: "staff", roles: [], resolvedGrants: grants }, "crm.accounts.read"),
    ).toBe(false);
  });

  it("gives nothing to a principal that is not staff, or for a key that names no row", () => {
    expect(holdsKey({ type: "client" }, "crm.leads.read")).toBe(false);
    expect(holdsKey({ type: "staff", roles: ["SA"] }, "not.a.key")).toBe(false);
  });
});
