/**
 * The shape of a §5.16 export against docs/permission-matrix.md (line in the test name): who may
 * export a report at all, which classes it carries (§4 line 130, P-10) and the fields of a named
 * variant ("the hotel rooming list").
 */
import { describe, expect, it } from "vitest";

import { exportShape, exportableClasses } from "./exports";

const ROOMING = "rooming_list_arrival_or";
const HOTELS = "hotel_shortlist_enquiries_site";

describe("export shape", () => {
  it("§4 line 130: strips the protected classes from every export", () => {
    const sa = exportableClasses(["SA"]);
    expect(sa.has("RESTRICTED-FINANCE")).toBe(true);
    expect(sa.has("SENSITIVE-GUEST")).toBe(false);
    expect(exportableClasses(["PM"]).has("RESTRICTED-FINANCE")).toBe(false);
  });

  it("§5.16 lines 324 and 332: a report's exclusions apply unless the role is excepted", () => {
    expect(exportableClasses(["HT"], HOTELS).has("RESTRICTED-FINANCE")).toBe(false);
    expect(exportableClasses(["SA"], HOTELS).has("RESTRICTED-FINANCE")).toBe(true);
    expect(exportableClasses(["SA"], HOTELS).has("INTERNAL")).toBe(true);
    expect(() => exportableClasses(["SA"], "no_such_report")).toThrow();
  });

  it("§5.16 line 324: Finance may not export the hotel shortlist report, so it has no shape", () => {
    expect(() => exportShape(["FA"], HOTELS)).toThrow(/export/);
    expect(() => exportableClasses(["FA"], HOTELS)).toThrow(/export/);
    expect(exportShape(["HT"], HOTELS).classes.has("RESTRICTED-FINANCE")).toBe(false);
  });

  it("§5.16 line 330: the hotel rooming list carries names, dates and room category only", () => {
    const hotelList = exportShape(["HL"], ROOMING, "hotel_rooming_list");
    expect(hotelList.onlyFields).toEqual(["names", "dates", "room_category"]);
    expect(hotelList.classes.has("RESTRICTED-IDENTITY")).toBe(false);
    const manifest = exportShape(["HL"], ROOMING);
    expect(manifest.onlyFields).toBeNull();
    expect(manifest.classes.has("RESTRICTED-IDENTITY")).toBe(false);
  });

  it("§5.16 line 330: PM may run the rooming list but not export it; a variant must be the report's", () => {
    expect(() => exportShape(["PM"], ROOMING)).toThrow(/export/);
    expect(() => exportShape(["SA"], ROOMING, "spreadsheet")).toThrow(/spreadsheet/);
    const funnel = "lead_source_conversion_funnel";
    expect(() => exportShape(["SA"], funnel, "hotel_rooming_list")).toThrow(/hotel_rooming_list/);
  });
});
