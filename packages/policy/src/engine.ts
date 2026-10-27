import type { ConditionFacts } from "./conditions";
import { decideGrants, type Decision, type Reach, type RoleGrant } from "./evaluate";
import { isAction, parsePermissionKey, permissionKey, type PermissionKey } from "./keys";
import { MATRIX } from "./matrix";
import { OUTSIDE_KEYS } from "./resources";
import type { PrincipalType, StaffRole } from "./roles";

/**
 * A key granted to one user on one wedding beyond their roles (P-5: identity documents).
 *
 * @example
 * const grant: ExplicitGrant = { key: "guests.identity_documents.read", projectId };
 */
export interface ExplicitGrant {
  /**
   * The key, as §10 spells it or as its base key: a scope suffix or a §10 alias of the same row
   * names the same grant (`guests.identity_documents.read:assigned`, line 547).
   */
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
 * const target: PolicyTarget = { projectId, ownerId: task.ownerUserId, side: "hotel" };
 */
export interface PolicyTarget extends ConditionFacts {
  readonly projectId?: string | undefined;
  readonly ownerId?: string | undefined;
}

const SYSTEM: Decision = { allowed: true, scope: "all", reason: "system" };
const NO_GRANT: Decision = { allowed: false, reason: "no_grant" };
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
 * // → [{ scope: "all", conditions: [{ kind: "side", anyOf: ["hotel"] }] }]
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

/** A §10 key named from outside its row's subsection (OUTSIDE_KEYS), as the row's own key. */
function outsideKey(key: string): string | null {
  const name = key.replace(/:(assigned|own)$/, "");
  const named = Object.hasOwn(OUTSIDE_KEYS, name) ? OUTSIDE_KEYS[name] : undefined;
  if (!named) return null;
  const row = MATRIX.staff.find((r) => r.section === named.section && r.label === named.label);
  return row ? `${row.module}.${row.resource}.${named.as}` : null;
}

/** The base key a key decides on: its own, or the §5 row a §10 key stands for. */
function baseKey(key: string): string | null {
  const outside = outsideKey(key);
  if (outside !== null) return outside;
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

function reachOf(principal: PolicyPrincipal, target: PolicyTarget): Reach {
  const { projectId, ownerId } = target;
  return {
    assigned: projectId !== undefined && principal.projectIds?.includes(projectId) === true,
    owned: ownerId !== undefined && ownerId === principal.userId,
  };
}

/** The grant is compared by the base key it decides on, so every spelling of the key counts. */
function holdsExplicitGrant(principal: PolicyPrincipal, base: string, projectId?: string) {
  if (projectId === undefined) return false;
  return (principal.explicitGrants ?? []).some(
    (grant) => grant.projectId === projectId && baseKey(grant.key) === base,
  );
}

/**
 * Step 4 of the pipeline (architecture §6): does the principal hold the key, does its scope reach
 * the target, and do the facts meet the conditions of its cell? Client, guest and demo principals
 * never hold keys; their reach is entitlement and membership (§3, §6), see decideReach().
 *
 * @example
 * decide(principal, "budget.budget_lines_internal_cost.read", { projectId, side: "hotel" });
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
  if (grants.length === 0) return NO_GRANT;
  const explicit = holdsExplicitGrant(principal, base, target.projectId);
  return decideGrants(grants, reachOf(principal, target), target, explicit);
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
