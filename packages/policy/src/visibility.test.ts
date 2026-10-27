import { describe, expect, it } from "vitest";

import { exportableClasses, principalReadableClasses, staffReadableClasses } from "./visibility";

describe("visibility classes", () => {
  it("opens finance and bank columns to Finance and the Super Admin only", () => {
    expect(staffReadableClasses(["FA"]).has("RESTRICTED-FINANCE")).toBe(true);
    expect(staffReadableClasses(["FA"]).has("RESTRICTED-BANK")).toBe(true);
    expect(staffReadableClasses(["SM"]).has("RESTRICTED-FINANCE")).toBe(false);
    expect(staffReadableClasses(["SA"]).has("SECRET")).toBe(false);
  });

  it("gives a project manager finance and sensitive fields on assigned projects only", () => {
    expect(staffReadableClasses(["PM"]).has("RESTRICTED-FINANCE")).toBe(false);
    expect(staffReadableClasses(["PM"], { assigned: true }).has("RESTRICTED-FINANCE")).toBe(true);
    expect(staffReadableClasses(["PM"], { assigned: true }).has("SENSITIVE-GUEST")).toBe(true);
  });

  it("keeps clients and guests to public and client fields, plus a guest's own row", () => {
    expect([...principalReadableClasses("client")]).toEqual(["PUBLIC", "CLIENT"]);
    expect(principalReadableClasses("guest", { ownRow: true }).has("SENSITIVE-GUEST")).toBe(true);
  });

  it("strips the protected classes from every export", () => {
    const sa = exportableClasses(["SA"]);
    expect(sa.has("RESTRICTED-FINANCE")).toBe(true);
    expect(sa.has("SENSITIVE-GUEST")).toBe(false);
    expect(exportableClasses(["PM"]).has("RESTRICTED-FINANCE")).toBe(false);
  });

  it("§5.16 lines 324 and 332: a report's exclusions apply unless the role is excepted", () => {
    const hotels = "hotel_shortlist_enquiries_site";
    expect(exportableClasses(["HT"], hotels).has("RESTRICTED-FINANCE")).toBe(false);
    expect(exportableClasses(["SA"], hotels).has("RESTRICTED-FINANCE")).toBe(true);
    expect(exportableClasses(["SA"], hotels).has("INTERNAL")).toBe(true);
    expect(() => exportableClasses(["SA"], "no_such_report")).toThrow();
  });
});
