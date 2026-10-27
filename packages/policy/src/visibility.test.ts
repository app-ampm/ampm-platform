/**
 * Visibility classes against docs/permission-matrix.md §4 (Readable by), §5 (the internal-notes rows)
 * and §6; expected values are copied from the document, line in the test name.
 */
import { describe, expect, it } from "vitest";

import { exportableClasses, principalReadableClasses, staffReadableClasses } from "./visibility";

const HOTELS = "hotels.hotel_profiles_client_fields";
const VENDORS = "vendors.vendor_profiles_client_fields";
const GUESTS = "guests.family_groups_guests_standard";

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

  it("§4 lines 123-124: HT and VC read finance and contacts on their own side only", () => {
    for (const role of ["HT", "VC"] as const) {
      const unsided = staffReadableClasses([role]);
      expect(unsided.has("RESTRICTED-FINANCE")).toBe(false);
      expect(unsided.has("RESTRICTED-CONTACT")).toBe(false);
    }
    expect(staffReadableClasses(["HT"], { side: "hotel" }).has("RESTRICTED-FINANCE")).toBe(true);
    expect(staffReadableClasses(["HT"], { side: "hotel" }).has("RESTRICTED-CONTACT")).toBe(true);
    expect(staffReadableClasses(["HT"], { side: "vendor" }).has("RESTRICTED-FINANCE")).toBe(false);
    expect(staffReadableClasses(["VC"], { side: "vendor" }).has("RESTRICTED-FINANCE")).toBe(true);
    expect(staffReadableClasses(["VC"], { side: "vendor" }).has("RESTRICTED-CONTACT")).toBe(true);
    expect(staffReadableClasses(["VC"], { side: "hotel" }).has("RESTRICTED-CONTACT")).toBe(false);
  });

  it("§4 line 122, §5.3 line 169: hotel internal notes for SA, SM, HT and PM, never CD, VC, RG, HL or FA", () => {
    for (const role of ["SA", "SM", "HT", "PM"] as const) {
      expect(staffReadableClasses([role], { resource: HOTELS }).has("RESTRICTED-NOTES")).toBe(true);
    }
    for (const role of ["CD", "VC", "RG", "HL", "FA"] as const) {
      const classes = staffReadableClasses([role], { resource: HOTELS, assigned: true });
      expect(classes.has("RESTRICTED-NOTES"), role).toBe(false);
    }
  });

  it("§5.8 line 232: vendor internal notes for SA and VC, PM on assigned weddings only", () => {
    expect(staffReadableClasses(["VC"], { resource: VENDORS }).has("RESTRICTED-NOTES")).toBe(true);
    expect(staffReadableClasses(["PM"], { resource: VENDORS }).has("RESTRICTED-NOTES")).toBe(false);
    expect(
      staffReadableClasses(["PM"], { resource: VENDORS, assigned: true }).has("RESTRICTED-NOTES"),
    ).toBe(true);
    for (const role of ["SM", "HL", "FA"] as const) {
      const classes = staffReadableClasses([role], { resource: VENDORS, assigned: true });
      expect(classes.has("RESTRICTED-NOTES"), role).toBe(false);
    }
  });

  it("§5.10 line 263: guest internal notes for RG, PM and HL on assigned weddings, never FA", () => {
    expect(
      staffReadableClasses(["RG"], { resource: GUESTS, assigned: true }).has("RESTRICTED-NOTES"),
    ).toBe(true);
    expect(staffReadableClasses(["RG"], { resource: GUESTS }).has("RESTRICTED-NOTES")).toBe(false);
    expect(
      staffReadableClasses(["FA"], { resource: GUESTS, assigned: true }).has("RESTRICTED-NOTES"),
    ).toBe(false);
  });

  it("§4 line 122: without a known resource no staff role reads internal notes", () => {
    expect(staffReadableClasses(["SA"]).has("RESTRICTED-NOTES")).toBe(false);
    expect(
      staffReadableClasses(["SA"], { resource: "hotels.nowhere" }).has("RESTRICTED-NOTES"),
    ).toBe(false);
  });

  it("§4 lines 120-121, §5.8 line 233: a role that cannot read the record's row gets public fields only", () => {
    const bank = "vendors.vendor_bank_details";
    expect([...staffReadableClasses(["CD"], { resource: bank, assigned: true })]).toEqual([
      "PUBLIC",
    ]);
    expect(staffReadableClasses(["FA"], { resource: bank }).has("RESTRICTED-BANK")).toBe(true);
    // §5.5 line 194: PM reads project notes on assigned weddings only.
    const notes = "projects.project_internal_notes";
    expect([...staffReadableClasses(["PM"], { resource: notes })]).toEqual(["PUBLIC"]);
    expect(staffReadableClasses(["PM"], { resource: notes, assigned: true }).has("INTERNAL")).toBe(
      true,
    );
    // A conditioned read counts with its facts only (§5.7 line 216, HT "RU hotel lines").
    const cost = "budget.budget_lines_internal_cost";
    expect([...staffReadableClasses(["HT"], { resource: cost })]).toEqual(["PUBLIC"]);
    expect(
      staffReadableClasses(["HT"], { resource: cost, side: "hotel" }).has("RESTRICTED-FINANCE"),
    ).toBe(true);
    expect([...staffReadableClasses(["SA"], { resource: "hotels.nowhere" })]).toEqual(["PUBLIC"]);
  });

  it("§6 line 359 over §4 line 126: a client representative never reads SENSITIVE-GUEST", () => {
    expect([...principalReadableClasses("client")]).toEqual(["PUBLIC", "CLIENT"]);
    expect(principalReadableClasses("client", { ownRow: true }).has("SENSITIVE-GUEST")).toBe(false);
    expect(principalReadableClasses("guest", { ownRow: true }).has("SENSITIVE-GUEST")).toBe(true);
    expect(principalReadableClasses("guest").has("SENSITIVE-GUEST")).toBe(false);
  });

  it("§4 line 130: strips the protected classes from every export", () => {
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
