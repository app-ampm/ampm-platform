import matrix from "./generated/matrix.json" with { type: "json" };
import {
  ACTION_LETTERS,
  type Action,
  type PrincipalType,
  type Scope,
  type StaffRole,
} from "./roles";

/** The matrix as generated from docs/permission-matrix.md (scripts/generate.ts). */
export interface Grant {
  readonly actions: readonly Action[];
  readonly scope: Scope;
  readonly note: string | null;
}

export interface MatrixRow {
  readonly section: string;
  readonly module: string;
  readonly resource: string;
  readonly label: string;
  readonly provisional: boolean;
  readonly cells: Readonly<Record<string, string>>;
  readonly grants: Readonly<Record<string, readonly Grant[]>>;
}

export interface Transition {
  readonly entity: string;
  readonly from: string;
  readonly to: string;
  readonly who: string;
  readonly roles: readonly { readonly role: string; readonly assigned: boolean }[];
  readonly system: boolean;
  readonly actors: readonly string[];
  readonly condition: string | null;
}

interface Matrix {
  readonly source: string;
  readonly staff: readonly MatrixRow[];
  readonly others: readonly MatrixRow[];
  readonly transitions: readonly Transition[];
}

export const MATRIX = matrix as Matrix;

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

/**
 * Step 4 of the pipeline (architecture §6): does the principal hold the key, and does the scope
 * reach the target? Client, guest and demo principals never hold keys; their reach is entitlement
 * and membership (§3, §6), checked by the services with `clientReach()`.
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
  let best: Scope | undefined;
  for (const role of principal.roles ?? []) {
    const scope = grantsForRole(role).get(base);
    if (scope && (!best || rank(scope) > rank(best))) best = scope;
  }
  if (!best) return { allowed: false, reason: "no_grant" };
  if (best === "all") return { allowed: true, scope: "all", reason: "granted" };
  if (best === "assigned") {
    const member =
      target.projectId !== undefined && (principal.projectIds ?? []).includes(target.projectId);
    return member
      ? { allowed: true, scope: "assigned", reason: "granted" }
      : { allowed: false, reason: "not_assigned" };
  }
  const owner = target.ownerId !== undefined && target.ownerId === principal.userId;
  return owner
    ? { allowed: true, scope: "own", reason: "granted" }
    : { allowed: false, reason: "not_owner" };
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

export interface TransitionContext {
  readonly assigned?: boolean | undefined;
  /** The principal is the record's assignee, owner, creator or requester. */
  readonly actor?: "assignee" | "owner" | "creator" | "requester" | undefined;
}

/** Step 6 of the pipeline: may this principal move an entity from one status to another (§7)? */
export function canTransition(
  principal: PolicyPrincipal,
  entity: string,
  from: string,
  to: string,
  context: TransitionContext = {},
): Transition | null {
  const rules = MATRIX.transitions.filter(
    (t) => t.entity === entity && matchesStatus(t.from, from) && matchesStatus(t.to, to),
  );
  for (const rule of rules) {
    if (principal.type === "system" && rule.system) return rule;
    if (principal.type === "client" && rule.roles.some((r) => r.role === "CR")) return rule;
    if (principal.type === "staff") {
      for (const grant of rule.roles) {
        if (grant.role === "CR" || !(principal.roles ?? []).includes(grant.role as StaffRole))
          continue;
        if (!grant.assigned || context.assigned) return rule;
      }
      if (context.actor && rule.actors.includes(context.actor)) return rule;
    }
  }
  return null;
}

function matchesStatus(pattern: string, status: string): boolean {
  const options = pattern
    .toLowerCase()
    .replace(/[`*]/g, "")
    .split(/\s*(?:,|\bor\b)\s*/)
    .map((option) => option.trim());
  return options.some(
    (option) => option === status.toLowerCase() || option === "any" || option.startsWith("any "),
  );
}
