import type { Condition } from "./conditions";
import type { RoleGrant } from "./evaluate";
import type { Grant, MatrixRow } from "./matrix";
// The generator (Node type-stripping) runs this module, so the one runtime import carries its
// extension, as the other generator-loaded sources do; the type-only imports above are erased.
import { STAFF_ROLE_CODES, type Action, type Scope, type StaffRole } from "./roles.ts";

/*
 * The code-defined capability catalog (D-036). Pure: no I/O, no matrix load, so the generator can
 * emit it (scripts/generate.ts → src/generated/capabilities.json) and the engine can build the same
 * set from MATRIX (capabilities.ts). A capability is one (key, scope, conditions) grant variant that
 * at least one of the nine system roles already holds; a custom role may only ever reference these,
 * so it can never invent a key, a scope or a condition, and a client/guest can never hold one.
 */

/**
 * One grantable capability: a single grant variant of the staff matrix, with the system roles that
 * hold it. The catalog of these is both the Super-Admin pick-list and the server-side allow-list.
 *
 * @example
 * GRANTABLE_CAPABILITIES.find((capability) => capability.module === "tasks" && capability.action === "read");
 */
export interface GrantableCapability {
  /** Stable id: `module.resource.action:scope`, with `#<condition-signature>` when conditioned. */
  readonly id: string;
  readonly module: string;
  readonly resource: string;
  readonly action: Action;
  readonly scope: Scope;
  readonly conditions: readonly Condition[];
  /** The system roles that hold exactly this grant; a custom role borrows their proven capability. */
  readonly sourceRoles: readonly StaffRole[];
  /** Every matrix capability is a staff capability; a non-staff principal can never hold one. */
  readonly isStaffOnly: boolean;
  /** Role/account administration and identity-document access: never assignable to a custom role. */
  readonly isEscalationLocked: boolean;
  readonly label: string;
}

const ACTION_TITLES: Record<Action, string> = {
  create: "Create",
  read: "Read",
  update: "Update",
  delete: "Delete",
  approve: "Approve",
  share: "Share",
  export: "Export",
};

/** One condition as a stable, order-independent token, so a signature never depends on list order. */
function conditionToken(condition: Condition): string {
  switch (condition.kind) {
    case "side":
      return `side:${[...condition.anyOf].sort().join("+")}`;
    case "subject":
      return `subject:${[...condition.anyOf].sort().join("+")}`;
    case "fields":
      return `fields:${[...condition.only].sort().join("+")}`;
    case "check":
      return `check:${condition.check}`;
    case "view":
      return `view:${condition.view}`;
    case "explicit_grant":
      return "explicit_grant";
  }
}

/**
 * A stable signature of a grant's conditions (empty for a plain grant), so two grants on one key that
 * differ only by their note ("RU hotel lines" vs "RU vendor") get different capability ids.
 *
 * @example
 * conditionSignature([{ kind: "side", anyOf: ["hotel"] }]); // "side:hotel"
 */
export function conditionSignature(conditions: readonly Condition[]): string {
  return conditions.map(conditionToken).sort().join(",");
}

/**
 * The stable id of a grant variant.
 *
 * @example
 * capabilityId("budget", "budget_lines_internal_cost", "read", "all", [{ kind: "side", anyOf: ["hotel"] }]);
 * // "budget.budget_lines_internal_cost.read:all#side:hotel"
 */
export function capabilityId(
  module: string,
  resource: string,
  action: Action,
  scope: Scope,
  conditions: readonly Condition[],
): string {
  const base = `${module}.${resource}.${action}:${scope}`;
  const signature = conditionSignature(conditions);
  return signature === "" ? base : `${base}#${signature}`;
}

/**
 * Whether a capability administers access itself (role, staff-user or client-login administration) or
 * opens identity documents. These are never assignable to a custom role: role administration is the
 * escalation vector, identity access is break-glass (security.md). Finance-export locking is refined
 * when the visibility layer becomes capability-driven.
 *
 * @example
 * isEscalationLocked("admin", "roles"); // true
 */
export function isEscalationLocked(module: string, resource: string): boolean {
  if (module === "admin" && /^(roles|staff_users|client_logins)/.test(resource)) return true;
  return resource.includes("identity_documents");
}

function capabilityLabel(rowLabel: string, action: Action, scope: Scope): string {
  const suffix = scope === "all" ? "" : ` (${scope})`;
  return `${ACTION_TITLES[action]} — ${rowLabel}${suffix}`;
}

type CatalogEntry = {
  readonly base: Omit<GrantableCapability, "sourceRoles">;
  readonly roles: Set<StaffRole>;
};

/** Records every action of one role's grant on one row, merging a role into a capability already seen. */
function registerGrant(
  byId: Map<string, CatalogEntry>,
  row: MatrixRow,
  code: StaffRole,
  grant: Grant,
): void {
  for (const action of grant.actions) {
    const id = capabilityId(row.module, row.resource, action, grant.scope, grant.conditions);
    const seen = byId.get(id);
    if (seen) {
      seen.roles.add(code);
      continue;
    }
    byId.set(id, {
      base: {
        id,
        module: row.module,
        resource: row.resource,
        action,
        scope: grant.scope,
        conditions: grant.conditions,
        isStaffOnly: true,
        isEscalationLocked: isEscalationLocked(row.module, row.resource),
        label: capabilityLabel(row.label, action, grant.scope),
      },
      roles: new Set<StaffRole>([code]),
    });
  }
}

/**
 * Every distinct (key, scope, conditions) grant variant of the staff matrix rows, each with the
 * system roles that hold it, sorted by id. Pure, so the generator and the engine build the same set.
 *
 * @example
 * const capabilities = buildGrantableCapabilities(MATRIX.staff);
 */
export function buildGrantableCapabilities(rows: readonly MatrixRow[]): GrantableCapability[] {
  const byId = new Map<string, CatalogEntry>();
  for (const row of rows) {
    for (const code of STAFF_ROLE_CODES) {
      for (const grant of row.grants[code] ?? []) registerGrant(byId, row, code, grant);
    }
  }
  return [...byId.values()]
    .map(({ base, roles }) => ({
      ...base,
      sourceRoles: STAFF_ROLE_CODES.filter((code) => roles.has(code)),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Compiles a list of capabilities into the grant map `decide()` unions through
 * `PolicyPrincipal.resolvedGrants`, keyed by the base key `module.resource.action`.
 *
 * @example
 * const grants = compileGrants([capability]);
 * decide({ type: "staff", userId, roles: [], resolvedGrants: grants }, key, target);
 */
export function compileGrants(
  capabilities: readonly GrantableCapability[],
): ReadonlyMap<string, readonly RoleGrant[]> {
  const grants = new Map<string, RoleGrant[]>();
  for (const capability of capabilities) {
    const base = `${capability.module}.${capability.resource}.${capability.action}`;
    grants.set(base, [
      ...(grants.get(base) ?? []),
      { scope: capability.scope, conditions: capability.conditions },
    ]);
  }
  return grants;
}
