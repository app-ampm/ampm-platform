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

/** The classes a staff role may read on a record, from the "Readable by" column of §4. */
export function staffReadableClasses(
  roles: readonly StaffRole[],
  context: ClassContext = {},
): ReadonlySet<VisibilityClass> {
  const set = new Set<VisibilityClass>(["PUBLIC", "CLIENT", "INTERNAL", "RESTRICTED-NOTES"]);
  const has = (role: StaffRole) => roles.includes(role);
  if (has("SA")) {
    for (const cls of [
      "RESTRICTED-FINANCE",
      "RESTRICTED-CONTACT",
      "RESTRICTED-BANK",
      "SENSITIVE-GUEST",
      "RESTRICTED-IDENTITY",
    ] as const)
      set.add(cls);
  }
  if (has("FA")) {
    set.add("RESTRICTED-FINANCE");
    set.add("RESTRICTED-BANK");
  }
  if (has("HT") && context.side !== "vendor") {
    set.add("RESTRICTED-CONTACT");
    set.add("RESTRICTED-FINANCE");
  }
  if (has("VC") && context.side !== "hotel") {
    set.add("RESTRICTED-CONTACT");
    set.add("RESTRICTED-FINANCE");
  }
  if (has("SM") && context.side === "hotel") set.add("RESTRICTED-CONTACT");
  if (context.assigned) {
    if (has("PM")) {
      set.add("RESTRICTED-FINANCE");
      set.add("RESTRICTED-CONTACT");
      set.add("SENSITIVE-GUEST");
    }
    if (has("HL")) {
      set.add("RESTRICTED-CONTACT");
      set.add("SENSITIVE-GUEST");
    }
    if (has("RG")) set.add("SENSITIVE-GUEST");
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
