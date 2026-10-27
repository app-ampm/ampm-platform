import type { PrincipalType, StaffRole } from "./roles";

/**
 * Field visibility classes (permission-matrix §4). Every column belongs to exactly one. A leaf
 * module, so the matrix loader and the visibility rules can both read it.
 *
 * @example
 * VISIBILITY_CLASSES.includes("RESTRICTED-NOTES"); // true
 */
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
/** @example const visibility: VisibilityClass = "RESTRICTED-FINANCE"; */
export type VisibilityClass = (typeof VISIBILITY_CLASSES)[number];

/**
 * Never exported, whatever the role (P-10).
 *
 * @example
 * NEVER_EXPORTED.includes("SENSITIVE-GUEST"); // true
 */
export const NEVER_EXPORTED: readonly VisibilityClass[] = [
  "SENSITIVE-GUEST",
  "RESTRICTED-IDENTITY",
  "RESTRICTED-BANK",
  "SECRET",
];

/**
 * Exported only by Finance and the Super Admin.
 *
 * @example
 * FINANCE_EXPORT_ROLES.includes("FA"); // true
 */
export const FINANCE_EXPORT_ROLES: readonly StaffRole[] = ["FA", "SA"];

/**
 * The values of a record's `visibility` column (`documents`, `media_assets`; data-model.md line 83).
 *
 * @example
 * RECORD_VISIBILITIES.includes("guest"); // true
 */
export const RECORD_VISIBILITIES = ["internal", "client", "guest", "public", "demo"] as const;
/** @example const visibility: RecordVisibility = "client"; */
export type RecordVisibility = (typeof RECORD_VISIBILITIES)[number];

/**
 * The record visibilities that admit a principal (§1 layer 5), or null when every value does.
 * Each outside audience reads what is addressed to it and what is public; nothing internal.
 *
 * @example
 * const admitted = admittedVisibilities(principal.type);
 * const where = admitted ? { visibility: { in: admitted } } : {};
 */
export function admittedVisibilities(type: PrincipalType): readonly RecordVisibility[] | null {
  if (type === "staff" || type === "system") return null;
  return [type, "public"];
}
