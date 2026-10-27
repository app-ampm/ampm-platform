/**
 * @ampm/policy: the permission matrix as code (docs/permission-matrix.md). Pure: no React, no I/O.
 * `pnpm authz:generate` rewrites src/generated/matrix.json from the document; the engine and the
 * generated authorisation suite read it.
 */
export const POLICY_VERSION = "0.2.0";

export {
  ACTION_LETTERS,
  OTHER_PRINCIPALS,
  STAFF_ROLES,
  STAFF_ROLE_CODES,
  roleFromKey,
} from "./roles";
export type { Action, PrincipalType, Scope, StaffRole, StaffRoleKey } from "./roles";
export {
  FINANCE_EXPORT_ROLES,
  NEVER_EXPORTED,
  VISIBILITY_CLASSES,
  exportableClasses,
  principalReadableClasses,
  staffReadableClasses,
} from "./visibility";
export type { ClassContext, VisibilityClass } from "./visibility";
export { MODULES, RESOURCES, slugify } from "./resources";
export {
  MATRIX,
  can,
  canTransition,
  clientReach,
  decide,
  grantsForRole,
  parsePermissionKey,
  permissionKey,
  permissionKeysForRole,
} from "./engine";
export type {
  Decision,
  Grant,
  MatrixRow,
  PermissionKey,
  PolicyPrincipal,
  PolicyTarget,
  Transition,
  TransitionContext,
} from "./engine";
export { resolveClientEntitlements } from "./entitlements";
export type { ClientAccountState, Entitlements } from "./entitlements";
