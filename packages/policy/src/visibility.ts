import { FINANCE_EXPORT_ROLES, type VisibilityClass } from "./classes";
import type { ConditionFacts, Side } from "./conditions";
import { decideGrants } from "./evaluate";
import { MATRIX, type MatrixRow, type ReportExclusion } from "./matrix";
import type { StaffRole } from "./roles";

/**
 * What the serialiser knows about the record whose fields it is about to send, with the facts a
 * conditioned grant needs (conditions.ts), as decide() takes them.
 *
 * @example
 * const context: ClassContext = { assigned: true, side: "vendor", resource: "vendors.vendor_profiles_client_fields" };
 */
export interface ClassContext extends ConditionFacts {
  /** The principal is a member of the project the record belongs to. */
  readonly assigned?: boolean | undefined;
  /** The principal owns or created the record. */
  readonly owned?: boolean | undefined;
  /** The record is a hotel-side record (HT) or a vendor-side record (VC); unsided otherwise. */
  readonly side?: Side | undefined;
  /** The record is the guest's own row. */
  readonly ownRow?: boolean | undefined;
  /**
   * The row the record is read through, `module.resource` as in the permission keys. With it, the
   * classes follow that row's §5 cell: a role that cannot read it gets public fields only.
   */
  readonly resource?: string | undefined;
}

/** Every staff role reads these on any record it may see at all. */
const BASE_CLASSES: readonly VisibilityClass[] = ["PUBLIC", "CLIENT", "INTERNAL"];
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
    // §4: "HT for hotel-side values", "VC for vendor-side values"; a record without a side is
    // neither, so it opens nothing (cost entries, final account totals, outbound payments).
    case "HT":
      return context.side === "hotel" ? CONTACT_AND_FINANCE : [];
    case "VC":
      return context.side === "vendor" ? CONTACT_AND_FINANCE : [];
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

function rowOf(resource: string | undefined): MatrixRow | undefined {
  return MATRIX.staff.find((row) => `${row.module}.${row.resource}` === resource);
}

/** Whether one of the roles reads the row's records in this context, evaluated as decide() does. */
function readsRow(roles: readonly StaffRole[], row: MatrixRow, context: ClassContext): boolean {
  const grants = roles.flatMap((role) =>
    (row.grants[role] ?? []).filter((grant) => grant.actions.includes("read")),
  );
  const reach = { assigned: context.assigned === true, owned: context.owned === true };
  return decideGrants(grants, reach, context, false).allowed;
}

/**
 * The row of the table a class row's columns belong to: "Vendor contacts" and "Vendor internal
 * rating and notes" are columns of the vendors, whose row is "Vendor profiles, client fields" (the
 * row their §10 keys name, resources.ts KEY_ALIASES). Any other row is its own table's.
 */
function tableRow(row: MatrixRow): MatrixRow {
  const parent = row.aliases.find((alias) => alias.resource !== row.resource);
  if (!parent) return row;
  const found = MATRIX.staff.find(
    (candidate) => candidate.module === row.module && candidate.resource === parent.resource,
  );
  return found ?? row;
}

/**
 * §4 RESTRICTED-NOTES, "staff with module access per §5": the internal-notes row of the record's
 * table ("Hotel internal rating and notes") when §5 has one, otherwise the table's row. Only a plain
 * read grant opens notes; a conditioned one ("RU (a) theme, dress code") does not. No resource, or
 * one the matrix does not know, opens nothing.
 */
function readsNotes(roles: readonly StaffRole[], context: ClassContext): boolean {
  const resourceRow = rowOf(context.resource);
  if (!resourceRow) return false;
  const row = tableRow(resourceRow);
  const notes =
    MATRIX.staff.find(
      (candidate) =>
        candidate.module === row.module &&
        candidate.aliases.some(
          (alias) => alias.resource === row.resource && alias.action === "read_internal_notes",
        ),
    ) ?? row;
  return roles.some((role) =>
    (notes.grants[role] ?? []).some(
      (grant) =>
        grant.actions.includes("read") &&
        grant.conditions.length === 0 &&
        (grant.scope === "all" ||
          (grant.scope === "assigned" && context.assigned === true) ||
          (grant.scope === "own" && context.owned === true)),
    ),
  );
}

/**
 * The classes staff roles may read on a record, from the "Readable by" column of §4. CLIENT and
 * INTERNAL are for "staff with module access per §5" (lines 120-121), so with a resource the roles
 * must read its row in this context, or they get public fields only; an unknown resource is none.
 * Without a resource the caller has decided the read already (decide()), and the base stands.
 *
 * @example
 * staffReadableClasses(["HT"], { side: "hotel", resource: "hotels.hotel_profiles_client_fields" });
 */
export function staffReadableClasses(
  roles: readonly StaffRole[],
  context: ClassContext = {},
): ReadonlySet<VisibilityClass> {
  if (context.resource !== undefined) {
    const row = rowOf(context.resource);
    if (!row || !readsRow(roles, row, context)) return new Set<VisibilityClass>(["PUBLIC"]);
  }
  const set = new Set<VisibilityClass>(BASE_CLASSES);
  if (readsNotes(roles, context)) set.add("RESTRICTED-NOTES");
  for (const role of GRANT_ORDER) {
    if (roles.includes(role)) for (const cls of roleGrants(role, context)) set.add(cls);
  }
  return set;
}

/**
 * Client, demo and guest principals read the public and client classes; a guest also their own
 * sensitive row. §4 still lists "Client Owner for their own wedding" for SENSITIVE-GUEST, but Q5
 * replaced that role and §6, rewritten for the representatives, gives CR "—" on guest sensitive
 * fields: the later, more specific rule holds, so a client never reads them.
 *
 * @example
 * principalReadableClasses("guest", { ownRow: true }).has("SENSITIVE-GUEST"); // true
 */
export function principalReadableClasses(
  type: "client" | "demo" | "guest",
  context: ClassContext = {},
): ReadonlySet<VisibilityClass> {
  const set = new Set<VisibilityClass>(["PUBLIC", "CLIENT"]);
  if (type === "guest" && context.ownRow) set.add("SENSITIVE-GUEST");
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
