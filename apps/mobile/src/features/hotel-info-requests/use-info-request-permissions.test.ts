import { staffAccessFor } from "@ampm/api-client";
import type { StaffRoleCode } from "@ampm/core";

import { infoRequestPermissionsFor } from "./use-info-request-permissions";

/** A signed-in staff member's access from their system roles and a custom role's capabilities. */
function permissions(roles: StaffRoleCode[], customCapabilities: string[] = []) {
  const access = staffAccessFor({
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
  return infoRequestPermissionsFor(access, roles);
}

describe("infoRequestPermissionsFor", () => {
  it("lets the Super Admin do everything, test requests included", () => {
    expect(permissions(["SA"])).toEqual({
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canMakeTests: true,
    });
  });

  it("lets the Hotel team read, send and change requests, but make no test request", () => {
    expect(permissions(["HT"])).toEqual({
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canMakeTests: false,
    });
  });

  it("leaves a Sales Manager and a Project Manager reading the summary, with no action", () => {
    const readOnly = { canRead: true, canCreate: false, canUpdate: false, canMakeTests: false };
    expect(permissions(["SM"])).toEqual(readOnly);
    expect(permissions(["PM"])).toEqual(readOnly);
  });

  it("offers Finance and Creative nothing", () => {
    const none = { canRead: false, canCreate: false, canUpdate: false, canMakeTests: false };
    expect(permissions(["FA"])).toEqual(none);
    expect(permissions(["CD"])).toEqual(none);
  });

  it("D-164: follows a custom role's grants, and never makes it a Super Admin", () => {
    const custom = permissions(
      [],
      ["hotels.info_requests.read:all", "hotels.info_requests.update:all"],
    );
    expect(custom).toEqual({
      canRead: true,
      canCreate: false,
      canUpdate: true,
      canMakeTests: false,
    });
  });
});
