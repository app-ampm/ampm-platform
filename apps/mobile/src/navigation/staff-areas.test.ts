import type { MeResponse, PrincipalType, StaffRoleCode } from "@ampm/core";
import { STAFF_ROLE_CODES } from "@ampm/policy";

import {
  activeStaffArea,
  hasStaffArea,
  rolesGrant,
  staffAreasFor,
  staffHomeHref,
} from "./staff-areas";

type Signed = Pick<MeResponse, "principal" | "roles">;

function signedIn(type: PrincipalType, roles: StaffRoleCode[]): Signed {
  return {
    principal: {
      type,
      userId: "018f0000-0000-7000-8000-00000000cafe",
      name: "Test Person",
      email: "person@example.com",
      phone: null,
      status: "active",
      lastLoginAt: null,
    },
    roles,
  };
}

const areaKeys = (me: Signed) => staffAreasFor(me).map((area) => area.key);

describe("staffAreasFor", () => {
  it("shows Sales the leads", () => {
    expect(areaKeys(signedIn("staff", ["SM"]))).toContain("leads");
  });

  it("shows the hotel team the enquiries", () => {
    expect(areaKeys(signedIn("staff", ["HT"]))).toContain("enquiries");
  });

  it.each(STAFF_ROLE_CODES)("gives %s the settings", (role) => {
    expect(areaKeys(signedIn("staff", [role]))).toContain("settings");
  });

  it.each(["SA", "PM", "CD", "VC", "RG", "HL"] as const)(
    "gives %s the tasks, whose field notes read as incidents",
    (role) => {
      expect(areaKeys(signedIn("staff", [role]))).toContain("tasks");
    },
  );

  it.each(["SM", "HT", "FA"] as const)("keeps the tasks from %s, which the API refuses", (role) => {
    expect(areaKeys(signedIn("staff", [role]))).not.toContain("tasks");
  });

  it("leaves out the areas a role does not grant", () => {
    // Creative reads neither leads nor enquiries (permission-matrix §5).
    expect(areaKeys(signedIn("staff", ["CD"]))).toEqual(["tasks", "settings"]);
  });

  it("adds up the areas of every role held, in the rail's order", () => {
    expect(areaKeys(signedIn("staff", ["CD", "FA"]))).toEqual(["enquiries", "tasks", "settings"]);
  });

  it("shows a client none", () => {
    expect(staffAreasFor(signedIn("client", []))).toEqual([]);
  });
});

describe("rolesGrant", () => {
  it("counts a key narrowed to a scope as the key", () => {
    // The project manager reads enquiries of their own weddings only: consultancy.enquiries.read:assigned.
    expect(rolesGrant(["PM"], "consultancy.enquiries.read")).toBe(true);
  });

  it("never takes a different key that starts the same way", () => {
    expect(rolesGrant(["SM"], "crm.leads.rea")).toBe(false);
    expect(rolesGrant([], "crm.leads.read")).toBe(false);
  });
});

describe("activeStaffArea", () => {
  it("finds the area from the path, detail screens included", () => {
    expect(activeStaffArea("/leads")?.key).toBe("leads");
    expect(activeStaffArea("/leads/018f0000-0000-7000-8000-0000000000a1")?.key).toBe("leads");
    expect(activeStaffArea("/enquiries/abc")?.key).toBe("enquiries");
    expect(activeStaffArea("/field-notes")?.key).toBe("tasks");
    expect(activeStaffArea("/account")?.key).toBe("settings");
  });

  it("finds none outside the workspace", () => {
    expect(activeStaffArea("/portal")).toBeUndefined();
    expect(activeStaffArea("/leadership")).toBeUndefined();
    expect(activeStaffArea("/")).toBeUndefined();
  });
});

describe("staffHomeHref", () => {
  it("lands a staff member on their first area", () => {
    expect(staffHomeHref(signedIn("staff", ["SM"]))).toBe("/leads");
    expect(staffHomeHref(signedIn("staff", ["FA"]))).toBe("/enquiries");
    expect(staffHomeHref(signedIn("staff", ["CD"]))).toBe("/field-notes");
  });

  it("lands a staff member whose roles grant no other area on the account screen", () => {
    expect(staffHomeHref(signedIn("staff", []))).toBe("/account");
  });
});

describe("hasStaffArea", () => {
  it("answers from the areas the roles grant", () => {
    expect(hasStaffArea(signedIn("staff", ["CD"]), "tasks")).toBe(true);
    expect(hasStaffArea(signedIn("staff", ["SM"]), "tasks")).toBe(false);
    expect(hasStaffArea(signedIn("client", []), "tasks")).toBe(false);
  });
});
