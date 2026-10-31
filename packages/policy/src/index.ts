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
export const POLICY_VERSION = "0.4.0";

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
  RECORD_VISIBILITIES,
  VISIBILITY_CLASSES,
  admittedVisibilities,
} from "./classes";
export type { RecordVisibility, VisibilityClass } from "./classes";
export { principalReadableClasses, staffReadableClasses } from "./visibility";
export type { ClassContext } from "./visibility";
export { exportShape, exportableClasses, reportExclusions } from "./exports";
export type { ExportShape } from "./exports";
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
export { KEY_ALIASES, MODULES, OUTSIDE_KEYS, RESOURCES, slugify } from "./resources";
export type { KeyAlias, OutsideKey } from "./resources";
export { CLASS_ACTIONS, VERB_ACTIONS, isAction, parsePermissionKey, permissionKey } from "./keys";
export type { ClassAction, KeyAction, ParsedKey, PermissionKey, VerbAction } from "./keys";
export { MATRIX } from "./matrix";
export type { Actor, Grant, MatrixRow, ReportExclusion, RowAlias, Transition } from "./matrix";
export {
  buildGrantableCapabilities,
  capabilityId,
  compileGrants,
  conditionSignature,
  isEscalationLocked,
} from "./catalog";
export type { GrantableCapability } from "./catalog";
export {
  GRANTABLE_CAPABILITIES,
  assignableCapabilities,
  capabilityById,
  resolveCustomGrants,
} from "./capabilities";
export type { ResolvedCustomGrants } from "./capabilities";
export {
  can,
  decide,
  decideBeforeRead,
  grantsForRole,
  holdsExplicitGrant,
  permissionKeysForRole,
  readKeyFor,
} from "./engine";
export type { ExplicitGrant, PolicyPrincipal, PolicyTarget } from "./engine";
export type { Decision, DenialReason, Reach, RoleGrant } from "./evaluate";
export { clientReach, decideReach } from "./reach";
export type { ReachPrincipal } from "./reach";
export { canTransition } from "./transitions";
export type { TransitionContext } from "./transitions";
export { STATUS_MACHINES } from "./statuses";
export type { ActorPrincipal, StatusMachine } from "./statuses";
export { resolveClientEntitlements } from "./entitlements";
export type {
  ClientAccountState,
  Entitlements,
  FinanceReach,
  HotelReach,
  RequestType,
  RequestTypes,
} from "./entitlements";
