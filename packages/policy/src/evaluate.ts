import { unmetConditions, type Condition, type ConditionFacts } from "./conditions";
import type { Scope } from "./roles";

/*
 * How a set of grants answers one target, apart from how the grants were found: decide() hands it
 * a staff principal's grants for a key, the visibility rules a role's grants on a row.
 */

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

/**
 * Where the target lies for the caller: on a wedding the caller is a member of, and owned by them.
 *
 * @example
 * const reach: Reach = { assigned: projectIds.includes(record.projectId), owned: false };
 */
export interface Reach {
  readonly assigned: boolean;
  readonly owned: boolean;
}

const NO_GRANT: Decision = { allowed: false, reason: "no_grant" };
/** Widest first, so the scope returned is the widest that matched. */
const WIDTH: readonly Scope[] = ["all", "assigned", "own"];

function scopeMiss(scope: Scope, reach: Reach): DenialReason | null {
  if (scope === "all") return null;
  if (scope === "assigned") return reach.assigned ? null : "not_assigned";
  return reach.owned ? null : "not_owner";
}

/**
 * §1 layer 2, permissions are the union of the roles: the first grant the target satisfies, widest
 * scope first. Otherwise the most useful denial: unmet conditions on a grant whose scope reached the
 * target, then the widest grant's scope failure.
 *
 * @example
 * const grants = grantsForRole("HL").get("guests.identity_documents.read") ?? [];
 * decideGrants(grants, { assigned: true, owned: false }, { checks: ["check_in"] }, false).allowed;
 * // true
 */
export function decideGrants(
  grants: readonly RoleGrant[],
  reach: Reach,
  facts: ConditionFacts,
  explicitGrant: boolean,
): Decision {
  const ordered = [...grants].sort((a, b) => WIDTH.indexOf(a.scope) - WIDTH.indexOf(b.scope));
  let unmetDenial: Decision | undefined;
  let scopeDenial: Decision | undefined;
  for (const grant of ordered) {
    const miss = scopeMiss(grant.scope, reach);
    if (miss !== null) {
      scopeDenial ??= { allowed: false, reason: miss };
      continue;
    }
    const unmet = unmetConditions(grant.conditions, facts, explicitGrant);
    if (unmet.length === 0) return { allowed: true, scope: grant.scope, reason: "granted" };
    unmetDenial ??= { allowed: false, reason: "condition_unmet", unmet };
  }
  return unmetDenial ?? scopeDenial ?? NO_GRANT;
}
