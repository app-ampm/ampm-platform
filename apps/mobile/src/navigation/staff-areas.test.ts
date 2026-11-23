import type { MeResponse, PrincipalType, StaffRoleCode } from "@ampm/core";
import { STAFF_ROLE_CODES } from "@ampm/policy";

import { activeStaffArea, hasStaffArea, staffAreasFor, staffHomeHref } from "./staff-areas";

type Signed = Pick<MeResponse, "principal" | "roles" | "customCapabilities">;

function signedIn(
  type: PrincipalType,
  roles: StaffRoleCode[],
  customCapabilities: string[] = [],
): Signed {
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
    customCapabilities,
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
    expect(areaKeys(signedIn("staff", ["CD", "FA"]))).toEqual([
      "enquiries",
      "tasks",
      "finance",
      "settings",
    ]);
  });

  it.each(["SA", "SM", "FA"] as const)(
    "gives %s Finance & Reports, whose subscription report they may run (§5.16)",
    (role) => {
      expect(areaKeys(signedIn("staff", [role]))).toContain("finance");
    },
  );

  it.each(["HT", "PM", "CD", "VC", "RG", "HL"] as const)(
    "keeps Finance & Reports from %s, who may not run the report",
    (role) => {
      expect(areaKeys(signedIn("staff", [role]))).not.toContain("finance");
    },
  );

  it("shows a client none", () => {
    expect(staffAreasFor(signedIn("client", []))).toEqual([]);
  });
});

describe("a staff member whose rights come from a custom role (D-164)", () => {
  /** "Sales assistant": the reproduction's custom role, minus its writes. */
  const SALES_ASSISTANT = [
    "crm.leads.read:all",
    "consultancy.enquiries.read:all",
    "reports.subscription_status_payment_history.read:all",
  ];

  it("sees the areas the custom role grants, with no system role at all", () => {
    expect(areaKeys(signedIn("staff", [], SALES_ASSISTANT))).toEqual([
      "leads",
      "enquiries",
      "finance",
      "settings",
    ]);
  });

  it("lands on the first of them", () => {
    expect(staffHomeHref(signedIn("staff", [], SALES_ASSISTANT))).toBe("/leads");
    expect(hasStaffArea(signedIn("staff", [], ["tasks.incidents.read:all"]), "tasks")).toBe(true);
  });

  it("adds the custom role's areas to a system role's", () => {
    expect(areaKeys(signedIn("staff", ["CD"], ["crm.leads.read:all"]))).toEqual([
      "leads",
      "tasks",
      "settings",
    ]);
  });

  it("ignores a capability the catalogue does not know, as the API does (fail-closed)", () => {
    expect(
      areaKeys(signedIn("staff", [], ["crm.leads.read:everything", "nope.not.real:all"])),
    ).toEqual(["settings"]);
  });

  it("gives a client none, whatever the response carries", () => {
    expect(staffAreasFor(signedIn("client", [], SALES_ASSISTANT))).toEqual([]);
  });
});

describe("activeStaffArea", () => {
  it("finds the area from the path, detail screens included", () => {
    expect(activeStaffArea("/leads")?.key).toBe("leads");
    expect(activeStaffArea("/leads/018f0000-0000-7000-8000-0000000000a1")?.key).toBe("leads");
    expect(activeStaffArea("/enquiries/abc")?.key).toBe("enquiries");
    expect(activeStaffArea("/field-notes")?.key).toBe("tasks");
    expect(activeStaffArea("/finance")?.key).toBe("finance");
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
    expect(staffHomeHref(signedIn("staff", ["HT"]))).toBe("/leads");
    expect(staffHomeHref(signedIn("staff", ["CD"]))).toBe("/field-notes");
  });

  it("lands Finance on Finance & Reports, ahead of the enquiries it may also read (D-128)", () => {
    expect(staffHomeHref(signedIn("staff", ["FA"]))).toBe("/finance");
    expect(staffHomeHref(signedIn("staff", ["SA"]))).toBe("/leads");
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
