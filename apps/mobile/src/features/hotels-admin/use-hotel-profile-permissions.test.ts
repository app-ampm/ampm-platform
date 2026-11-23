import { staffAccessFor } from "@ampm/api-client";
import type { StaffRoleCode } from "@ampm/core";

import { hotelProfilePermissionsFor } from "./use-hotel-profile-permissions";

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

describe("hotelProfilePermissionsFor", () => {
  it("lets the Hotel team and the Super Admin edit the internal rating and notes", () => {
    expect(hotelProfilePermissionsFor(access(["HT"]))).toEqual({ canEditNotes: true });
    expect(hotelProfilePermissionsFor(access(["SA"]))).toEqual({ canEditNotes: true });
  });

  it("leaves Sales and a Project Manager, who only read them, and Finance, who cannot, without", () => {
    for (const role of ["SM", "PM", "FA"] as const) {
      expect(hotelProfilePermissionsFor(access([role]))).toEqual({ canEditNotes: false });
    }
  });

  it("D-164: decides a custom role from its grants, a profile editor alone getting no notes", () => {
    const editor = access([], ["hotels.hotel_profiles_client_fields.update:all"]);
    expect(hotelProfilePermissionsFor(editor)).toEqual({ canEditNotes: false });
    const notes = access([], ["hotels.hotel_internal_rating_notes.update:all"]);
    expect(hotelProfilePermissionsFor(notes)).toEqual({ canEditNotes: true });
  });
});
