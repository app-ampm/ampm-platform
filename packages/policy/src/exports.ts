import { FINANCE_EXPORT_ROLES, NEVER_EXPORTED, type VisibilityClass } from "./classes";
import { grantsForRole } from "./engine";
import { MATRIX, type ReportExclusion } from "./matrix";
import type { StaffRole } from "./roles";

/*
 * What a §5.16 export may carry: the classes of §4's last paragraph (P-10), less what the report
 * excludes, and for a named variant its own fields; NEVER_EXPORTED is stripped last, whatever the
 * rest allowed. The guard decides the export key on the target first; these functions refuse
 * roles that do not hold it at all, so a caller that forgot the guard gets an error, never a shape.
 */

/**
 * One export as it may be built for the roles.
 *
 * @example
 * const { classes, onlyFields } = exportShape(["HL"], "rooming_list_arrival_or", "hotel_rooming_list");
 */
export interface ExportShape {
  readonly classes: ReadonlySet<VisibilityClass>;
  /** The variant's field allow-list ("names, dates and room category only"), or null for the report. */
  readonly onlyFields: readonly string[] | null;
}

/**
 * What a §5.16 report's export leaves out; an unknown report stops the export.
 *
 * @example
 * reportExclusions("vendor_selection_contracts_deliverables");
 * // → [{ kind: "class", class: "RESTRICTED-BANK", unlessRoles: [] }]
 */
export function reportExclusions(report: string): readonly ReportExclusion[] {
  const row = MATRIX.staff.find(
    (candidate) => candidate.module === "reports" && candidate.resource === report,
  );
  if (!row) throw new Error(`no §5.16 report "${report}"`);
  return row.exclusions;
}

function baseClasses(roles: readonly StaffRole[]): Set<VisibilityClass> {
  const set = new Set<VisibilityClass>(["PUBLIC", "CLIENT", "INTERNAL"]);
  if (roles.some((role) => FINANCE_EXPORT_ROLES.includes(role))) set.add("RESTRICTED-FINANCE");
  return set;
}

/** §4 line 130 (P-10): these classes leave in no export, whatever the base and the report allow. */
function withoutNeverExported(classes: Set<VisibilityClass>): Set<VisibilityClass> {
  for (const cls of NEVER_EXPORTED) classes.delete(cls);
  return classes;
}

/**
 * The shape of a §5.16 report's export for the roles, or of its named variant. Throws unless a role
 * holds `reports.<report>.export` (its scope on the target is decide()'s), and on an unknown report
 * or a variant the report does not have. The classes never include NEVER_EXPORTED (P-10).
 *
 * @example
 * exportShape(["HL"], "rooming_list_arrival_or", "hotel_rooming_list").onlyFields;
 * // → ["names", "dates", "room_category"]
 */
export function exportShape(
  roles: readonly StaffRole[],
  report: string,
  variant?: string,
): ExportShape {
  const exclusions = reportExclusions(report);
  const key = `reports.${report}.export`;
  if (!roles.some((role) => (grantsForRole(role).get(key) ?? []).length > 0)) {
    throw new Error(`${roles.join(", ") || "no role"} may not export the report "${report}"`);
  }
  const classes = baseClasses(roles);
  for (const exclusion of exclusions) {
    if (exclusion.kind !== "class") continue;
    if (!roles.some((role) => exclusion.unlessRoles.includes(role)))
      classes.delete(exclusion.class);
  }
  withoutNeverExported(classes);
  if (variant === undefined) return { classes, onlyFields: null };
  const named = exclusions.find(
    (exclusion) => exclusion.kind === "variant" && exclusion.variant === variant,
  );
  if (named?.kind !== "variant")
    throw new Error(`the report "${report}" has no variant "${variant}"`);
  return { classes, onlyFields: named.onlyFields };
}

/**
 * The classes an export may carry for the roles (§4, last paragraph), never NEVER_EXPORTED; with a
 * report, its exportShape()'s classes, so a role that may not export the report gets an error.
 *
 * @example
 * exportableClasses(["FA"], "budget_internal").has("RESTRICTED-FINANCE"); // true
 * exportableClasses(["SA"]).has("RESTRICTED-BANK"); // false
 */
export function exportableClasses(
  roles: readonly StaffRole[],
  report?: string,
): ReadonlySet<VisibilityClass> {
  if (report !== undefined) return exportShape(roles, report).classes;
  return withoutNeverExported(baseClasses(roles));
}
