import type { VisibilityClass } from "./classes";
import type { ConditionFacts, Side } from "./conditions";
import { decideGrants } from "./evaluate";
import { MATRIX, type MatrixRow } from "./matrix";
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
   * The principal holds the explicit grant P-5 names on the record's wedding, which an RG needs
   * for identity documents (§5.10 line 265): holdsExplicitGrant(principal, key, projectId).
   */
  readonly explicitGrant?: boolean | undefined;
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
/**
 * §4 line 124, the records with RESTRICTED-CONTACT columns: hotel contacts, the vendors' contact
 * fields, external venue contacts and drivers' phones, as the §5 rows that hold them.
 */
const CONTACT_ROWS: readonly (readonly [section: string, label: string])[] = [
  ["5.3", "Hotel contacts"],
  ["5.8", "Vendor contacts"],
  ["5.5", "Project hotels and external venues"],
  ["5.11", "Vehicles, transfers, passengers"],
];
/** The roles §4 line 124 gives contacts by the record they are on, not by its side. */
const CONTACTS_BY_ROW: readonly StaffRole[] = ["PM", "HL"];
/** §4 line 127: RESTRICTED-IDENTITY is the identity documents table, read through its §5.10 row. */
const IDENTITY_ROW = { section: "5.10", label: "Identity documents" } as const;

/** What one role adds to the base classes on a record, given the record's context (§4 "Readable by"). */
function roleGrants(role: StaffRole, context: ClassContext): readonly VisibilityClass[] {
  switch (role) {
    // Identity documents follow their row's conditions (readsIdentity): SA by break-glass only.
    case "SA":
      return ["RESTRICTED-FINANCE", "RESTRICTED-CONTACT", "RESTRICTED-BANK", "SENSITIVE-GUEST"];
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
    // PM and HL read contacts through the contacts rows (readsContacts).
    case "PM":
      return context.assigned ? ["RESTRICTED-FINANCE", "SENSITIVE-GUEST"] : [];
    case "HL":
      return context.assigned ? ["SENSITIVE-GUEST"] : [];
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
  return decideGrants(grants, reach, context, context.explicitGrant === true).allowed;
}

/**
 * §4 line 127 by the §5.10 cell (line 265): SA "R break-glass", RG "with explicit grant" on assigned
 * weddings, HL "check-in only" on assigned weddings; the facts come in the context, as decide()
 * takes them, so the class and the key never disagree.
 */
function readsIdentity(roles: readonly StaffRole[], context: ClassContext): boolean {
  const row = MATRIX.staff.find(
    (candidate) =>
      candidate.section === IDENTITY_ROW.section && candidate.label === IDENTITY_ROW.label,
  );
  return row !== undefined && readsRow(roles, row, context);
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
 * A plain read grant on the row at a scope the context satisfies. A class column opens on it only:
 * a conditioned read ("RU (a) theme, dress code") names the columns or records it covers.
 */
function readsPlainly(roles: readonly StaffRole[], row: MatrixRow, context: ClassContext) {
  return roles.some((role) =>
    (row.grants[role] ?? []).some(
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
 * §4 RESTRICTED-NOTES, "staff with module access per §5": the internal-notes row of the record's
 * table ("Hotel internal rating and notes") when §5 has one, otherwise the table's row. No resource,
 * or one the matrix does not know, opens nothing.
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
  return readsPlainly(roles, notes, context);
}

function isContactRow(row: MatrixRow): boolean {
  return CONTACT_ROWS.some(([section, label]) => row.section === section && row.label === label);
}

/**
 * §4 line 124 for PM and HL: contacts open on the record's contacts row (the resource's own, or
 * its table's: hotel profiles have "Hotel contacts") when their §5 cell there reads it. No
 * resource, or a record without contact columns, opens none.
 */
function readsContacts(roles: readonly StaffRole[], context: ClassContext): boolean {
  const resourceRow = rowOf(context.resource);
  if (!resourceRow) return false;
  const table = tableRow(resourceRow);
  const contacts = isContactRow(resourceRow)
    ? resourceRow
    : MATRIX.staff.find((row) => isContactRow(row) && row !== table && tableRow(row) === table);
  const byRow = roles.filter((role) => CONTACTS_BY_ROW.includes(role));
  return contacts !== undefined && readsPlainly(byRow, contacts, context);
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
  if (readsContacts(roles, context)) set.add("RESTRICTED-CONTACT");
  if (readsIdentity(roles, context)) set.add("RESTRICTED-IDENTITY");
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
