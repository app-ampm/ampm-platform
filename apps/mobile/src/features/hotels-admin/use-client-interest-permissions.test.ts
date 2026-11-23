import { staffAccessFor } from "@ampm/api-client";
import type { StaffRoleCode } from "@ampm/core";

import { clientInterestPermissionsFor } from "./use-client-interest-permissions";

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

describe("clientInterestPermissionsFor", () => {
  it("lets the Hotel team, Sales and the Super Admin read clients' saves and open the client", () => {
    for (const role of ["HT", "SM", "SA"] as const) {
      expect(clientInterestPermissionsFor(access([role]))).toEqual({
        canReadSavedHotels: true,
        canOpenClient: true,
      });
    }
  });

  it("gives a Project Manager neither: the assigned grants do not reach these project-less routes", () => {
    expect(clientInterestPermissionsFor(access(["PM"]))).toEqual({
      canReadSavedHotels: false,
      canOpenClient: false,
    });
  });

  it("gives Finance and Creative no read of clients' saves", () => {
    expect(clientInterestPermissionsFor(access(["FA"])).canReadSavedHotels).toBe(false);
    expect(clientInterestPermissionsFor(access(["CD"])).canReadSavedHotels).toBe(false);
  });

  it("D-164: follows a custom role's grants, with no system role", () => {
    expect(clientInterestPermissionsFor(access([], ["hotels.saved_hotels.read:all"]))).toEqual({
      canReadSavedHotels: true,
      canOpenClient: false,
    });
  });
});
