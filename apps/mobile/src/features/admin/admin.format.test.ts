import {
  authenticatorLabel,
  authenticatorTone,
  lastSignInLabel,
  roleName,
  roleSummary,
  staffUserSummary,
  userStatusLabel,
  userStatusTone,
} from "./admin.format";
import { staffUserFixture } from "./admin.test-utils";

describe("admin.format", () => {
  it("labels each account status and gives it the right chip tone", () => {
    expect(userStatusLabel("active")).toBe("Active");
    expect(userStatusLabel("invited")).toBe("Invited");
    expect(userStatusLabel("disabled")).toBe("Disabled");
    expect(userStatusLabel("locked")).toBe("Locked");
    expect(userStatusTone("active")).toBe("success");
    expect(userStatusTone("invited")).toBe("warning");
    expect(userStatusTone("disabled")).toBe("neutral");
    expect(userStatusTone("locked")).toBe("danger");
  });

  it("maps a role key to its display name and leaves an unknown key as itself", () => {
    expect(roleName("super_admin")).toBe("Super Admin");
    expect(roleName("sales")).toBe("Sales / Relationship Manager");
    expect(roleName("project_manager")).toBe("Wedding Project Manager");
    expect(roleName("not_a_role")).toBe("not_a_role");
  });

  it("joins the roles, and says so when there are none", () => {
    expect(roleSummary(["super_admin", "finance"])).toBe("Super Admin, Finance / Accounts");
    expect(roleSummary([])).toBe("No roles");
  });

  it("shows the last sign-in, or 'Never' when they have not signed in", () => {
    expect(lastSignInLabel(null)).toBe("Never");
    expect(lastSignInLabel("2026-11-02T08:30:00Z")).not.toBe("Never");
  });

  it("labels the authenticator state with a matching tone", () => {
    expect(authenticatorLabel(true)).toBe("Authenticator on");
    expect(authenticatorLabel(false)).toBe("No authenticator");
    expect(authenticatorTone(true)).toBe("success");
    expect(authenticatorTone(false)).toBe("info");
  });

  it("summarises a user's roles and status for a screen reader", () => {
    expect(staffUserSummary(staffUserFixture())).toBe("Super Admin, Active");
    expect(staffUserSummary(staffUserFixture({ roles: [], status: "disabled" }))).toBe(
      "No roles, Disabled",
    );
  });
});
