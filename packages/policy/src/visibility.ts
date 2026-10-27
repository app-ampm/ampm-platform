import type { StaffRole } from "./roles";

/** Field visibility classes (permission-matrix §4). Every column belongs to exactly one. */
export const VISIBILITY_CLASSES = [
  "PUBLIC",
  "CLIENT",
  "INTERNAL",
  "RESTRICTED-NOTES",
  "RESTRICTED-FINANCE",
  "RESTRICTED-CONTACT",
  "RESTRICTED-BANK",
  "SENSITIVE-GUEST",
  "RESTRICTED-IDENTITY",
  "SECRET",
] as const;
export type VisibilityClass = (typeof VISIBILITY_CLASSES)[number];

/** Never exported, whatever the role (P-10). */
export const NEVER_EXPORTED: readonly VisibilityClass[] = [
  "SENSITIVE-GUEST",
  "RESTRICTED-IDENTITY",
  "RESTRICTED-BANK",
  "SECRET",
];

/** Exported only by Finance and the Super Admin. */
export const FINANCE_EXPORT_ROLES: readonly StaffRole[] = ["FA", "SA"];

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

/** The classes an export may carry for a role (§4, last paragraph). */
export function exportableClasses(roles: readonly StaffRole[]): ReadonlySet<VisibilityClass> {
  const set = new Set<VisibilityClass>(["PUBLIC", "CLIENT", "INTERNAL"]);
  if (roles.some((role) => FINANCE_EXPORT_ROLES.includes(role))) set.add("RESTRICTED-FINANCE");
  return set;
}
