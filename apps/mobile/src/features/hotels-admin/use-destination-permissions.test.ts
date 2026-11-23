import { staffAccessFor } from "@ampm/api-client";
import type { StaffRoleCode } from "@ampm/core";

import { destinationPermissionsFor } from "./use-destination-permissions";

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

describe("destinationPermissionsFor", () => {
  it("lets the Hotel team and the Super Admin add and edit destinations", () => {
    const all = { canCreate: true, canUpdate: true };
    expect(destinationPermissionsFor(access(["HT"]))).toEqual(all);
    expect(destinationPermissionsFor(access(["SA"]))).toEqual(all);
  });

  it("leaves a Sales Manager and a Project Manager, who only read them, with no changes", () => {
    const none = { canCreate: false, canUpdate: false };
    expect(destinationPermissionsFor(access(["SM"]))).toEqual(none);
    expect(destinationPermissionsFor(access(["PM"]))).toEqual(none);
  });

  it("D-164: lets a custom role edit destinations when its grants allow it, and nothing more", () => {
    const custom = access([], ["hotels.destinations.read:all", "hotels.destinations.update:all"]);
    expect(destinationPermissionsFor(custom)).toEqual({ canCreate: false, canUpdate: true });
  });
});
