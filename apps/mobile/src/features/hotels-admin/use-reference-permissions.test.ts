import { staffAccessFor } from "@ampm/api-client";
import type { StaffRoleCode } from "@ampm/core";

import { referencePermissionsFor } from "./use-reference-permissions";

/** A signed-in staff member's access from their system roles and a custom role's capabilities. */
function access(roles: StaffRoleCode[], customCapabilities: string[] = []) {
  return staffAccessFor({
    principal: {
      type: "staff",
      userId: "018f0000-0000-7000-8000-00000000cafe",
      name: "Test Person",
      email: "person@example.com",
      phone: null,
      status: "active",
      lastLoginAt: null,
    },
    roles,
    customCapabilities,
  });
}

describe("referencePermissionsFor", () => {
  it("lets the Hotel team and the Super Admin change references", () => {
    const all = { canCreate: true, canUpdate: true, canDelete: true };
    expect(referencePermissionsFor(access(["HT"]))).toEqual(all);
    expect(referencePermissionsFor(access(["SA"]))).toEqual(all);
  });

  it("leaves a Sales Manager, who only reads them, with no changes", () => {
    expect(referencePermissionsFor(access(["SM"]))).toEqual({
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    });
  });

  it("D-164: lets a custom role edit references when its grants allow it, and nothing more", () => {
    const custom = access(
      [],
      ["hotels.wedding_references.read:all", "hotels.wedding_references.update:all"],
    );
    expect(referencePermissionsFor(custom)).toEqual({
      canCreate: false,
      canUpdate: true,
      canDelete: false,
    });
  });
});
