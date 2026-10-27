import { MATRIX, type Grant } from "./matrix";
import {
  ACTION_LETTERS,
  type Action,
  type PrincipalType,
  type Scope,
  type StaffRole,
} from "./roles";

/** `module.resource.action` with an optional `:assigned` or `:own` suffix (permission-matrix §10). */
export type PermissionKey =
  `${string}.${string}.${Action}` | `${string}.${string}.${Action}:${Exclude<Scope, "all">}`;

export function permissionKey(
  module: string,
  resource: string,
  action: Action,
  scope: Scope = "all",
): PermissionKey {
  const base = `${module}.${resource}.${action}` as const;
  return scope === "all" ? base : (`${base}:${scope}` as PermissionKey);
}

export function parsePermissionKey(
  key: string,
): { module: string; resource: string; action: Action; scope: Scope } | null {
  const match = /^([a-z0-9_]+)\.([a-z0-9_]+)\.([a-z_]+)(?::(assigned|own))?$/.exec(key);
  if (!match) return null;
  const action = match[3] as Action;
  if (!Object.values(ACTION_LETTERS).includes(action)) return null;
  return {
    module: match[1] ?? "",
    resource: match[2] ?? "",
    action,
    scope: (match[4] as Scope | undefined) ?? "all",
  };
}

/** Every key a staff role holds, with the scope the matrix gives it. */
export function grantsForRole(role: StaffRole): ReadonlyMap<string, Scope> {
  const out = new Map<string, Scope>();
  for (const row of MATRIX.staff) {
    for (const grant of row.grants[role] ?? []) {
      for (const action of grant.actions) {
        const base = `${row.module}.${row.resource}.${action}`;
        const existing = out.get(base);
        // A wider scope wins when the same key appears twice (all > assigned > own).
        if (!existing || rank(grant.scope) > rank(existing)) out.set(base, grant.scope);
      }
    }
  }
  return out;
}

function rank(scope: Scope): number {
  return scope === "all" ? 3 : scope === "assigned" ? 2 : 1;
}

export function permissionKeysForRole(role: StaffRole): PermissionKey[] {
  return [...grantsForRole(role)].map(
    ([base, scope]) => (scope === "all" ? base : `${base}:${scope}`) as PermissionKey,
  );
}

/** What the engine needs to know about the caller. Built by the API from its own records. */
export interface PolicyPrincipal {
  readonly type: PrincipalType;
  readonly userId?: string | undefined;
  readonly roles?: readonly StaffRole[] | undefined;
  /** Projects the principal is an active member of. */
  readonly projectIds?: readonly string[] | undefined;
}

/** The record or project an action targets. */
export interface PolicyTarget {
  readonly projectId?: string | undefined;
  readonly ownerId?: string | undefined;
}

export interface Decision {
  readonly allowed: boolean;
  /** The scope that granted the action, when allowed. */
  readonly scope?: Scope | undefined;
  readonly reason: "granted" | "not_staff" | "no_grant" | "not_assigned" | "not_owner" | "system";
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

/**
 * Step 4 of the pipeline (architecture §6): does the principal hold the key, and does the scope
 * reach the target? Client, guest and demo principals never hold keys; their reach is entitlement
 * and membership (§3, §6), checked by the services with `clientReach()`.
 *
 * §1 layer 2: permissions are the union of the roles. Assigned (member weddings) and own (records
 * the user owns) are different sets, not one inside the other, so every scope a role gives is tried,
 * widest first, and the first that reaches the target answers; else the widest one's refusal.
 *
 * @example
 * decide({ type: "staff", userId, roles: ["PM", "FA"], projectIds }, "tasks.tasks.read", { ownerId });
 */
export function decide(
  principal: PolicyPrincipal,
  key: string,
  target: PolicyTarget = {},
): Decision {
  if (principal.type === "system") return { allowed: true, scope: "all", reason: "system" };
  if (principal.type !== "staff") return { allowed: false, reason: "not_staff" };
  const parsed = parsePermissionKey(key);
  if (!parsed) return { allowed: false, reason: "no_grant" };
  const base = `${parsed.module}.${parsed.resource}.${parsed.action}`;
  const scopes = (principal.roles ?? [])
    .flatMap((role) => grantsForRole(role).get(base) ?? [])
    .sort((a, b) => rank(b) - rank(a));
  const [widest] = scopes;
  if (widest === undefined) return { allowed: false, reason: "no_grant" };
  const reached = scopes.find((scope) => scopeMiss(scope, principal, target) === null);
  if (reached) return { allowed: true, scope: reached, reason: "granted" };
  return { allowed: false, reason: scopeMiss(widest, principal, target) ?? "no_grant" };
}

export function can(principal: PolicyPrincipal, key: string, target?: PolicyTarget): boolean {
  return decide(principal, key, target).allowed;
}

/** The §6 cell for a client, guest or demo principal on a resource row, by label or resource slug. */
export function clientReach(type: "client" | "guest" | "demo", resource: string): readonly Grant[] {
  const column = type === "client" ? "CR" : type === "guest" ? "GU" : "DP";
  const row = MATRIX.others.find(
    (candidate) => candidate.resource === resource || candidate.label === resource,
  );
  return row?.grants[column] ?? [];
}
