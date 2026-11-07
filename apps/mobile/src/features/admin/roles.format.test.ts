import {
  capabilityGroups,
  moduleLabel,
  permissionCountLabel,
  roleSummary,
  roleTypeLabel,
  roleTypeTone,
} from "./roles.format";
import { capabilityViewFixture, roleViewFixture } from "./admin.test-utils";

describe("roles.format", () => {
  it("labels and tones a role by kind", () => {
    expect(roleTypeLabel(true)).toBe("System");
    expect(roleTypeLabel(false)).toBe("Custom");
    expect(roleTypeTone(true)).toBe("brand");
    expect(roleTypeTone(false)).toBe("neutral");
  });

  it("counts permissions in words", () => {
    expect(permissionCountLabel(0)).toBe("No permissions");
    expect(permissionCountLabel(1)).toBe("1 permission");
    expect(permissionCountLabel(4)).toBe("4 permissions");
  });

  it("humanises a module slug", () => {
    expect(moduleLabel("hotel_discovery")).toBe("Hotel discovery");
    expect(moduleLabel("budget")).toBe("Budget");
  });

  it("groups capabilities by module, modules and rows sorted by label", () => {
    const groups = capabilityGroups([
      capabilityViewFixture({ id: "b", module: "weddings", label: "Read — Weddings" }),
      capabilityViewFixture({ id: "a", module: "admin", label: "Update — Configuration" }),
      capabilityViewFixture({ id: "c", module: "admin", label: "Create — Role" }),
    ]);
    expect(groups.map((group) => group.label)).toEqual(["Admin", "Weddings"]);
    expect(groups[0]?.capabilities.map((capability) => capability.label)).toEqual([
      "Create — Role",
      "Update — Configuration",
    ]);
  });

  it("summarises a role row for screen readers", () => {
    const role = roleViewFixture({
      name: "Sales",
      isSystem: true,
      capabilities: [capabilityViewFixture()],
    });
    expect(roleSummary(role)).toBe("Sales, system role, 1 permission");
  });
});
