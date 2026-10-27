import type { StaffRole } from "./roles";

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
