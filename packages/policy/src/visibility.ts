import { FINANCE_EXPORT_ROLES, type VisibilityClass } from "./classes";
import { MATRIX, type ReportExclusion } from "./matrix";
import type { StaffRole } from "./roles";

export interface ClassContext {
  /** The principal is a member of the project the record belongs to. */
  readonly assigned?: boolean | undefined;
  /** The record is a hotel-side record (HT) or a vendor-side record (VC). */
  readonly side?: "hotel" | "vendor" | undefined;
  /** The record is the guest's own row. */
  readonly ownRow?: boolean | undefined;
}

/** Every staff role reads these on any record it may see at all. */
const BASE_CLASSES: readonly VisibilityClass[] = [
  "PUBLIC",
  "CLIENT",
  "INTERNAL",
  "RESTRICTED-NOTES",
];
const CONTACT_AND_FINANCE: readonly VisibilityClass[] = [
  "RESTRICTED-CONTACT",
  "RESTRICTED-FINANCE",
];
/** The order the grants are applied in, which fixes the order of the resulting set. */
const GRANT_ORDER: readonly StaffRole[] = ["SA", "FA", "HT", "VC", "SM", "PM", "HL", "RG"];

/** What one role adds to the base classes on a record, given the record's context (§4 "Readable by"). */
function roleGrants(role: StaffRole, context: ClassContext): readonly VisibilityClass[] {
  switch (role) {
    case "SA":
      return [
        "RESTRICTED-FINANCE",
        "RESTRICTED-CONTACT",
        "RESTRICTED-BANK",
        "SENSITIVE-GUEST",
        "RESTRICTED-IDENTITY",
      ];
    case "FA":
      return ["RESTRICTED-FINANCE", "RESTRICTED-BANK"];
    case "HT":
      return context.side === "vendor" ? [] : CONTACT_AND_FINANCE;
    case "VC":
      return context.side === "hotel" ? [] : CONTACT_AND_FINANCE;
    case "SM":
      return context.side === "hotel" ? ["RESTRICTED-CONTACT"] : [];
    case "PM":
      return context.assigned
        ? ["RESTRICTED-FINANCE", "RESTRICTED-CONTACT", "SENSITIVE-GUEST"]
        : [];
    case "HL":
      return context.assigned ? ["RESTRICTED-CONTACT", "SENSITIVE-GUEST"] : [];
    case "RG":
      return context.assigned ? ["SENSITIVE-GUEST"] : [];
    default:
      return [];
  }
}

/** The classes a staff role may read on a record, from the "Readable by" column of §4. */
export function staffReadableClasses(
  roles: readonly StaffRole[],
  context: ClassContext = {},
): ReadonlySet<VisibilityClass> {
  const set = new Set<VisibilityClass>(BASE_CLASSES);
  for (const role of GRANT_ORDER) {
    if (roles.includes(role)) for (const cls of roleGrants(role, context)) set.add(cls);
  }
  return set;
}

/** Client, demo and guest principals read the public and client classes; a guest also their own sensitive row. */
export function principalReadableClasses(
  type: "client" | "demo" | "guest",
  context: ClassContext = {},
): ReadonlySet<VisibilityClass> {
  const set = new Set<VisibilityClass>(["PUBLIC", "CLIENT"]);
  if (type === "guest" && context.ownRow) set.add("SENSITIVE-GUEST");
  if (type === "client" && context.ownRow) set.add("SENSITIVE-GUEST");
  return set;
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

/**
 * The classes an export may carry for a role (§4, last paragraph), less what the report excludes.
 *
 * @example
 * exportableClasses(["FA"], "budget_internal").has("RESTRICTED-FINANCE"); // true
 */
export function exportableClasses(
  roles: readonly StaffRole[],
  report?: string,
): ReadonlySet<VisibilityClass> {
  const set = new Set<VisibilityClass>(["PUBLIC", "CLIENT", "INTERNAL"]);
  if (roles.some((role) => FINANCE_EXPORT_ROLES.includes(role))) set.add("RESTRICTED-FINANCE");
  if (report === undefined) return set;
  for (const exclusion of reportExclusions(report)) {
    const kept =
      exclusion.kind === "class" && roles.some((role) => exclusion.unlessRoles.includes(role));
    if (exclusion.kind === "class" && !kept) set.delete(exclusion.class);
  }
  return set;
}
