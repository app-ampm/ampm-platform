/*
 * @ampm/policy: the permission matrix as code (docs/permission-matrix.md). Pure: no React, no I/O.
 * `pnpm authz:generate` rewrites src/generated/matrix.json from the document; the engine and the
 * generated authorisation suite read it.
 */

/**
 * The version of the rules this build carries. It changes when what a grant means changes (a new
 * condition kind, a changed engine rule), so logs and seeds can say which rules applied.
 *
 * @example
 * logger.info("policy.loaded", { version: POLICY_VERSION });
 */
export const POLICY_VERSION = "0.3.0";

export {
  ACTION_LETTERS,
  OTHER_PRINCIPALS,
  STAFF_ROLES,
  STAFF_ROLE_CODES,
  roleFromKey,
} from "./roles";
export type { Action, PrincipalType, Scope, StaffRole, StaffRoleKey } from "./roles";
export { FINANCE_EXPORT_ROLES, NEVER_EXPORTED, VISIBILITY_CLASSES } from "./classes";
export type { VisibilityClass } from "./classes";
export {
  exportableClasses,
  principalReadableClasses,
  reportExclusions,
  staffReadableClasses,
} from "./visibility";
export type { ClassContext } from "./visibility";
export { CHECKS, FIELD_GROUPS, SIDES, SUBJECTS, VIEWS, unmetConditions } from "./conditions";
export type {
  Check,
  Condition,
  ConditionFacts,
  FieldGroup,
  Side,
  Subject,
  View,
} from "./conditions";
export { KEY_ALIASES, MODULES, RESOURCES, slugify } from "./resources";
export { CLASS_ACTIONS, VERB_ACTIONS, isAction, parsePermissionKey, permissionKey } from "./keys";
export type { ClassAction, KeyAction, ParsedKey, PermissionKey, VerbAction } from "./keys";
export { MATRIX } from "./matrix";
export type { Actor, Grant, MatrixRow, ReportExclusion, RowAlias, Transition } from "./matrix";
export { can, decide, grantsForRole, permissionKeysForRole } from "./engine";
export type {
  Decision,
  DenialReason,
  ExplicitGrant,
  PolicyPrincipal,
  PolicyTarget,
  RoleGrant,
} from "./engine";
export { clientReach, decideReach } from "./reach";
export type { ReachPrincipal } from "./reach";
export { canTransition } from "./transitions";
export type { TransitionContext } from "./transitions";
export { STATUS_MACHINES } from "./statuses";
export type { ActorPrincipal, StatusMachine } from "./statuses";
export { resolveClientEntitlements } from "./entitlements";
export type { ClientAccountState, Entitlements, HotelReach } from "./entitlements";
