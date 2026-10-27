/**
 * Golden cases for the §5.16 reports and exports table: who may run and export each report and what
 * its export leaves out, written out by hand from docs/permission-matrix.md lines 322-332, never read
 * from matrix.json. Report keys are `reports.<report>.read` (May run) and `reports.<report>.export`.
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { decide, type PolicyPrincipal } from "./engine";
import { RESOURCES, slugify } from "./resources";
import { STAFF_ROLE_CODES, type StaffRole } from "./roles";
import { reportExclusions } from "./exports";

interface Golden {
  readonly line: number;
  readonly label: string;
  readonly run: readonly string[];
  readonly export: readonly string[];
  readonly excluded: readonly unknown[];
}

const FINANCE_UNLESS_FA_SA = {
  kind: "class",
  class: "RESTRICTED-FINANCE",
  unlessRoles: ["FA", "SA"],
};

const GOLDEN: readonly Golden[] = [
  {
    line: 322,
    label: "Lead source and conversion funnel",
    run: ["SA", "SM"],
    export: ["SA", "SM"],
    excluded: [],
  },
  {
    line: 323,
    label: "Subscription status and payment history",
    run: ["SA", "SM", "FA"],
    export: ["SA", "FA"],
    excluded: [],
  },
  {
    line: 324,
    label: "Hotel shortlist, enquiries, site visits, booking milestones",
    run: ["SA", "HT", "SM", "PM (a)"],
    export: ["SA", "HT"],
    excluded: [FINANCE_UNLESS_FA_SA],
  },
  {
    line: 325,
    label: "Wedding progress, deadlines, approval tracker",
    run: ["SA", "PM (a)", "SM"],
    export: ["SA", "PM (a)"],
    excluded: [],
  },
  {
    line: 326,
    label: "Budget estimate, approved, payments, actual, variance (client view)",
    run: ["SA", "FA", "PM (a)"],
    export: ["SA", "FA", "PM (a)"],
    excluded: [],
  },
  {
    line: 327,
    label: "Internal cost and margin variance",
    run: ["SA", "FA", "PM (a)"],
    export: ["SA", "FA"],
    excluded: [],
  },
  {
    line: 328,
    label: "Vendor selection, contracts, deliverables, payment status",
    run: ["SA", "VC", "PM (a)", "FA"],
    export: ["SA", "VC", "FA"],
    excluded: [{ kind: "class", class: "RESTRICTED-BANK", unlessRoles: [] }],
  },
  {
    line: 329,
    label: "RSVP progress and function attendance",
    run: ["SA", "RG (a)", "PM (a)", "HL (a)"],
    export: ["SA", "RG (a)", "PM (a)"],
    excluded: [{ kind: "class", class: "SENSITIVE-GUEST", unlessRoles: [] }],
  },
  {
    line: 330,
    label: "Rooming list and arrival or departure manifests",
    run: ["SA", "HL (a)", "RG (a)", "PM (a)"],
    export: ["SA", "HL (a)"],
    excluded: [
      { kind: "class", class: "RESTRICTED-IDENTITY", unlessRoles: [] },
      {
        kind: "variant",
        variant: "hotel_rooming_list",
        onlyFields: ["names", "dates", "room_category"],
        audited: true,
      },
    ],
  },
  {
    line: 331,
    label: "Function schedules, run-of-show, production readiness",
    run: ["SA", "PM (a)", "HL (a)", "VC (a)"],
    export: ["SA", "PM (a)"],
    excluded: [],
  },
  {
    line: 332,
    label: "Overdue tasks, incidents, final reconciliation, closure report",
    run: ["SA", "PM (a)", "FA"],
    export: ["SA", "PM (a)"],
    excluded: [FINANCE_UNLESS_FA_SA],
  },
];

function staff(role: StaffRole): PolicyPrincipal {
  return { type: "staff", userId: "u-1", roles: [role], projectIds: ["p-1"] };
}

/** The scope a role holds in a "May run" or "May export" list: "SA" all, "PM (a)" assigned. */
function listed(list: readonly string[], role: StaffRole): "all" | "assigned" | null {
  if (list.includes(role)) return "all";
  return list.includes(`${role} (a)`) ? "assigned" : null;
}

function expectReach(key: string, role: StaffRole, scope: "all" | "assigned" | null): void {
  if (scope === null) {
    expect(decide(staff(role), key, { projectId: "p-1" }).allowed, `${role} ${key}`).toBe(false);
  } else if (scope === "all") {
    expect(decide(staff(role), key), `${role} ${key}`).toMatchObject({ allowed: true, scope });
  } else {
    expect(decide(staff(role), key, { projectId: "p-1" }), `${role} ${key}`).toMatchObject({
      allowed: true,
      scope,
    });
    expect(decide(staff(role), key, { projectId: "p-2" }).reason).toBe("not_assigned");
  }
}

describe("§5.16 reports and exports", () => {
  it("holds every report row of §5.16, on the line and under the label the document gives it", () => {
    const document = documentTableRows("### 5.16", "## 6. Permission matrix");
    expect(GOLDEN.map((golden) => [golden.line, golden.label])).toEqual(
      document.map((row) => [row.line, row.cells[0]]),
    );
  });

  it("§10 line 552: the internal cost and margin export is reports.budget_internal.export (FA, SA)", () => {
    expect(RESOURCES["5.16"]?.["Internal cost and margin variance"]).toBe("budget_internal");
    expect(decide(staff("FA"), "reports.budget_internal.export").allowed).toBe(true);
    expect(decide(staff("SA"), "reports.budget_internal.export").allowed).toBe(true);
    expect(
      decide(staff("PM"), "reports.budget_internal.export", { projectId: "p-1" }).allowed,
    ).toBe(false);
  });

  for (const golden of GOLDEN) {
    const report = RESOURCES["5.16"]?.[golden.label] ?? slugify(golden.label);

    it(`§5.16 line ${golden.line}: ${golden.label} runs and exports for exactly the listed roles`, () => {
      for (const role of STAFF_ROLE_CODES) {
        expectReach(`reports.${report}.read`, role, listed(golden.run, role));
        expectReach(`reports.${report}.export`, role, listed(golden.export, role));
      }
    });

    it(`§5.16 line ${golden.line}: ${golden.label} leaves out what the document excludes`, () => {
      expect(reportExclusions(report)).toEqual(golden.excluded);
    });
  }
});
