import { unmetConditions, type Condition, type ConditionFacts } from "./conditions";
import { isAction, parsePermissionKey, permissionKey, type PermissionKey } from "./keys";
import { MATRIX } from "./matrix";
import type { PrincipalType, Scope, StaffRole } from "./roles";

/**
 * A role's hold on one key: the scope its cell reaches and the conditions its note sets.
 *
 * @example
 * grantsForRole("RG").get("guests.identity_documents.read");
 * // → [{ scope: "assigned", conditions: [{ kind: "explicit_grant" }] }]
 */
export interface RoleGrant {
  readonly scope: Scope;
  readonly conditions: readonly Condition[];
}

/**
 * A key granted to one user on one wedding beyond their roles (P-5: identity documents).
 *
 * @example
 * const grant: ExplicitGrant = { key: "guests.identity_documents.read", projectId };
 */
export interface ExplicitGrant {
  /** The base key, `module.resource.action` without a scope suffix. */
  readonly key: string;
  readonly projectId: string;
}

/**
 * What the engine needs to know about the caller. Built by the API from its own records.
 *
 * @example
 * const principal: PolicyPrincipal = { type: "staff", userId, roles: ["PM"], projectIds };
 */
export interface PolicyPrincipal {
  readonly type: PrincipalType;
  readonly userId?: string | undefined;
  readonly roles?: readonly StaffRole[] | undefined;
  /** Projects the principal is an active member of; for a guest token, the wedding of its link. */
  readonly projectIds?: readonly string[] | undefined;
  /** Client accounts a client principal belongs to: "own" is its wedding or account (§6 line 338). */
  readonly accountIds?: readonly string[] | undefined;
  readonly explicitGrants?: readonly ExplicitGrant[] | undefined;
}

/**
 * The record or project an action targets, and what the caller knows about it (conditions.ts).
 *
 * @example
 * const target: PolicyTarget = { projectId, ownerId: task.ownerUserId, subjects: ["hotel"] };
 */
export interface PolicyTarget extends ConditionFacts {
  readonly projectId?: string | undefined;
  readonly ownerId?: string | undefined;
}

/**
 * Why decide() refused.
 *
 * @example
 * if (decision.reason === "condition_unmet") logger.info("needs", { unmet: decision.unmet });
 */
export type DenialReason =
  | "not_staff"
  | "no_grant"
  | "not_assigned"
  | "not_owner"
  /** A grant reaches the target but its conditions are not met by the facts given. */
  | "condition_unmet";

/**
 * decide()'s answer.
 *
 * @example
 * const { allowed, scope, reason } = decide(principal, "tasks.tasks.read", target);
 */
export interface Decision {
  readonly allowed: boolean;
  /** The scope of the grant that allowed the action. */
  readonly scope?: Scope | undefined;
  readonly reason: "granted" | "system" | DenialReason;
  /** With condition_unmet: what the caller would have to establish. */
  readonly unmet?: readonly Condition[] | undefined;
}

const SYSTEM: Decision = { allowed: true, scope: "all", reason: "system" };
const NO_GRANT: Decision = { allowed: false, reason: "no_grant" };
/** Widest first, so the scope returned is the widest that matched. */
const WIDTH: readonly Scope[] = ["all", "assigned", "own"];
const byRole = new Map<StaffRole, ReadonlyMap<string, readonly RoleGrant[]>>();

function buildGrants(role: StaffRole): ReadonlyMap<string, readonly RoleGrant[]> {
  const out = new Map<string, RoleGrant[]>();
  for (const row of MATRIX.staff) {
    for (const grant of row.grants[role] ?? []) {
      for (const action of grant.actions) {
        const base = `${row.module}.${row.resource}.${action}`;
        const held = { scope: grant.scope, conditions: grant.conditions };
        out.set(base, [...(out.get(base) ?? []), held]);
      }
    }
  }
  return out;
}

/**
 * Every key a staff role holds, with the scope and conditions of each grant.
 *
 * @example
 * grantsForRole("HT").get("budget.budget_lines_internal_cost.read");
 * // → [{ scope: "all", conditions: [{ kind: "subject", anyOf: ["hotel"] }] }]
 */
export function grantsForRole(role: StaffRole): ReadonlyMap<string, readonly RoleGrant[]> {
  const known = byRole.get(role);
  if (known) return known;
  const built = buildGrants(role);
  byRole.set(role, built);
  return built;
}

/**
 * The keys a role holds outright, for `role_permissions`. A conditioned grant ("RU hotel lines")
 * is not a key the role holds by itself, so it is left out: decide() alone evaluates it.
 *
 * @example
 * permissionKeysForRole("PM").includes("projects.wedding_projects.update:assigned"); // true
 */
export function permissionKeysForRole(role: StaffRole): PermissionKey[] {
  return MATRIX.staff.flatMap((row) =>
    (row.grants[role] ?? [])
      .filter((grant) => grant.conditions.length === 0)
      .flatMap((grant) =>
        grant.actions.map((action) => permissionKey(row.module, row.resource, action, grant.scope)),
      ),
  );
}

/** The base key a key decides on: its own, or the §5 row a §10 alias key stands for. */
function baseKey(key: string): string | null {
  const parsed = parsePermissionKey(key);
  if (!parsed) return null;
  const { module, resource, action } = parsed;
  if (isAction(action)) return `${module}.${resource}.${action}`;
  for (const row of MATRIX.staff) {
    if (row.module !== module) continue;
    const alias = row.aliases.find((a) => a.resource === resource && a.action === action);
    if (alias) return `${module}.${row.resource}.${alias.as}`;
  }
  return null;
}

function scopeMiss(scope: Scope, principal: PolicyPrincipal, target: PolicyTarget) {
  if (scope === "all") return null;
  if (scope === "assigned") {
    const member =
      target.projectId !== undefined && principal.projectIds?.includes(target.projectId);
    return member ? null : "not_assigned";
  }
  return target.ownerId !== undefined && target.ownerId === principal.userId ? null : "not_owner";
}

function holdsExplicitGrant(principal: PolicyPrincipal, base: string, projectId?: string) {
  if (projectId === undefined) return false;
  return (principal.explicitGrants ?? []).some((g) => g.key === base && g.projectId === projectId);
}

/**
 * §1 layer 2, permissions are the union of the roles: the first grant the target satisfies, widest
 * scope first. Otherwise the most useful denial: unmet conditions on a grant whose scope reached the
 * target, then the widest grant's scope failure.
 */
function evaluate(
  grants: readonly RoleGrant[],
  principal: PolicyPrincipal,
  base: string,
  target: PolicyTarget,
): Decision {
  const explicit = holdsExplicitGrant(principal, base, target.projectId);
  const ordered = [...grants].sort((a, b) => WIDTH.indexOf(a.scope) - WIDTH.indexOf(b.scope));
  let unmetDenial: Decision | undefined;
  let scopeDenial: Decision | undefined;
  for (const grant of ordered) {
    const miss = scopeMiss(grant.scope, principal, target);
    if (miss !== null) {
      scopeDenial ??= { allowed: false, reason: miss };
      continue;
    }
    const unmet = unmetConditions(grant.conditions, target, explicit);
    if (unmet.length === 0) return { allowed: true, scope: grant.scope, reason: "granted" };
    unmetDenial ??= { allowed: false, reason: "condition_unmet", unmet };
  }
  return unmetDenial ?? scopeDenial ?? NO_GRANT;
}

/**
 * Step 4 of the pipeline (architecture §6): does the principal hold the key, does its scope reach
 * the target, and do the facts meet the conditions of its cell? Client, guest and demo principals
 * never hold keys; their reach is entitlement and membership (§3, §6), see decideReach().
 *
 * @example
 * decide(principal, "budget.budget_lines_internal_cost.read", { projectId, subjects: ["hotel"] });
 */
export function decide(
  principal: PolicyPrincipal,
  key: string,
  target: PolicyTarget = {},
): Decision {
  if (principal.type === "system") return SYSTEM;
  if (principal.type !== "staff") return { allowed: false, reason: "not_staff" };
  const base = baseKey(key);
  if (base === null) return NO_GRANT;
  const grants = (principal.roles ?? []).flatMap((role) => grantsForRole(role).get(base) ?? []);
  return grants.length === 0 ? NO_GRANT : evaluate(grants, principal, base, target);
}

/**
 * decide(), as a boolean.
 *
 * @example
 * if (!can(principal, "admin.roles.update")) throw errors.forbidden();
 */
export function can(principal: PolicyPrincipal, key: string, target?: PolicyTarget): boolean {
  return decide(principal, key, target).allowed;
}
