/**
 * The shape of a §5.16 export against docs/permission-matrix.md (line in the test name): who may
 * export a report at all, which classes it carries (§4 line 130, P-10) and the fields of a named
 * variant ("the hotel rooming list").
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { NEVER_EXPORTED, type VisibilityClass } from "./classes";
import { exportShape, exportableClasses, reportExclusions } from "./exports";
import { RESOURCES, slugify } from "./resources";
import { STAFF_ROLE_CODES, type StaffRole } from "./roles";

const ROOMING = "rooming_list_arrival_or";
const HOTELS = "hotel_shortlist_enquiries_site";

/*
 * §4 line 130 (P-10, .claude/rules/security.md): an export carries PUBLIC, CLIENT and INTERNAL,
 * RESTRICTED-FINANCE only for FA and SA, and never SENSITIVE-GUEST, RESTRICTED-IDENTITY,
 * RESTRICTED-BANK or SECRET. The paragraph names no other class, so notes and contacts stay out.
 */
const EXPORTED: readonly VisibilityClass[] = ["PUBLIC", "CLIENT", "INTERNAL"];
const FINANCE_EXPORTERS: readonly StaffRole[] = ["FA", "SA"];
const P10_NEVER: readonly VisibilityClass[] = [
  "SENSITIVE-GUEST",
  "RESTRICTED-IDENTITY",
  "RESTRICTED-BANK",
  "SECRET",
];

/** Each §5.16 report as the document's text has it: its key's resource and its "May export" roles. */
const REPORTS = documentTableRows("### 5.16", "## 6. Permission matrix").map((row) => {
  const label = row.cells[0] ?? "";
  const exporters = (row.cells[2] ?? "").split(",").map((item) => item.trim());
  return {
    line: row.line,
    report: RESOURCES["5.16"]?.[label] ?? slugify(label),
    exporters: exporters.map((item) => item.replace(/ \(a\)$/, "")),
  };
});

/** Every set of one or two staff roles: a user may hold several (§1 line 51). */
const ROLE_SETS: readonly (readonly StaffRole[])[] = STAFF_ROLE_CODES.flatMap((first, at) => [
  [first],
  ...STAFF_ROLE_CODES.slice(at + 1).map((second) => [first, second]),
]);

function expectP10(roles: readonly StaffRole[], classes: ReadonlySet<VisibilityClass>, at: string) {
  const finance = roles.some((role) => FINANCE_EXPORTERS.includes(role));
  const allowed = finance ? [...EXPORTED, "RESTRICTED-FINANCE"] : EXPORTED;
  const carried = [...classes];
  const found = {
    neverExported: carried.filter((cls) => NEVER_EXPORTED.includes(cls) || P10_NEVER.includes(cls)),
    notesOrContacts: carried.filter(
      (cls) => cls === "RESTRICTED-NOTES" || cls === "RESTRICTED-CONTACT",
    ),
    beyondTheParagraph: carried.filter((cls) => !allowed.includes(cls)),
  };
  expect(found, at).toEqual({ neverExported: [], notesOrContacts: [], beyondTheParagraph: [] });
}

describe("§4 line 130, P-10: what every export may carry", () => {
  it("§4 line 130: NEVER_EXPORTED is the paragraph's list", () => {
    expect([...NEVER_EXPORTED].sort()).toEqual([...P10_NEVER].sort());
  });

  it("§4 line 130: the classes of an export for any roles, before a report narrows them", () => {
    for (const roles of ROLE_SETS) expectP10(roles, exportableClasses(roles), roles.join("+"));
  });

  for (const { line, report, exporters } of REPORTS) {
    it(`§5.16 line ${line}, §4 line 130: every role that exports ${report} gets a P-10 shape`, () => {
      const variants = reportExclusions(report).flatMap((exclusion) =>
        exclusion.kind === "variant" ? [exclusion.variant] : [],
      );
      for (const roles of ROLE_SETS) {
        const at = `${roles.join("+")} ${report}`;
        if (!roles.some((role) => exporters.includes(role))) {
          expect(() => exportShape(roles, report), at).toThrow(/may not export/);
          continue;
        }
        expectP10(roles, exportShape(roles, report).classes, at);
        expectP10(roles, exportableClasses(roles, report), at);
        for (const variant of variants) {
          expectP10(roles, exportShape(roles, report, variant).classes, `${at} ${variant}`);
        }
      }
    });
  }
});

describe("export shape", () => {
  it("§4 line 130: strips the protected classes from every export", () => {
    const sa = exportableClasses(["SA"]);
    expect(sa.has("RESTRICTED-FINANCE")).toBe(true);
    expect(sa.has("SENSITIVE-GUEST")).toBe(false);
    expect(exportableClasses(["PM"]).has("RESTRICTED-FINANCE")).toBe(false);
  });

  it("§5.16 lines 325 and 332: a report's exclusions apply unless the role is excepted", () => {
    expect(exportableClasses(["HT"], HOTELS).has("RESTRICTED-FINANCE")).toBe(false);
    expect(exportableClasses(["SA"], HOTELS).has("RESTRICTED-FINANCE")).toBe(true);
    expect(exportableClasses(["SA"], HOTELS).has("INTERNAL")).toBe(true);
    expect(() => exportableClasses(["SA"], "no_such_report")).toThrow();
  });

  it("§5.16 line 325: Finance may not export the hotel shortlist report, so it has no shape", () => {
    expect(() => exportShape(["FA"], HOTELS)).toThrow(/export/);
    expect(() => exportableClasses(["FA"], HOTELS)).toThrow(/export/);
    expect(exportShape(["HT"], HOTELS).classes.has("RESTRICTED-FINANCE")).toBe(false);
  });

  it("§5.16 line 331: the hotel rooming list carries names, dates and room category only", () => {
    const hotelList = exportShape(["HL"], ROOMING, "hotel_rooming_list");
    expect(hotelList.onlyFields).toEqual(["names", "dates", "room_category"]);
    expect(hotelList.classes.has("RESTRICTED-IDENTITY")).toBe(false);
    const manifest = exportShape(["HL"], ROOMING);
    expect(manifest.onlyFields).toBeNull();
    expect(manifest.classes.has("RESTRICTED-IDENTITY")).toBe(false);
  });

  it("§5.16 line 331: PM may run the rooming list but not export it; a variant must be the report's", () => {
    expect(() => exportShape(["PM"], ROOMING)).toThrow(/export/);
    expect(() => exportShape(["SA"], ROOMING, "spreadsheet")).toThrow(/spreadsheet/);
    const funnel = "lead_source_conversion_funnel";
    expect(() => exportShape(["SA"], funnel, "hotel_rooming_list")).toThrow(/hotel_rooming_list/);
  });
});
