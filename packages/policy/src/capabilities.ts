import { buildGrantableCapabilities, compileGrants, type GrantableCapability } from "./catalog";
import type { RoleGrant } from "./evaluate";
import { MATRIX } from "./matrix";
import type { StaffRole } from "./roles";

/*
 * The grantable-capability catalog built from the loaded matrix, plus the lookup and the fail-closed
 * resolver the API uses to turn a custom role's stored capability ids into engine grants (D-036).
 * This module loads MATRIX, so it is never imported by the generator; the generator uses the pure
 * builder in catalog.ts directly.
 */

/**
 * The capability catalog for this build. The committed `src/generated/capabilities.json` is the same
 * set serialised (scripts/generate.ts writes it), so the DB seed and the CI drift check cover it.
 *
 * @example
 * GRANTABLE_CAPABILITIES.filter((capability) => !capability.isEscalationLocked);
 */
export const GRANTABLE_CAPABILITIES: readonly GrantableCapability[] = buildGrantableCapabilities(
  MATRIX.staff,
);

const BY_ID = new Map<string, GrantableCapability>(
  GRANTABLE_CAPABILITIES.map((capability) => [capability.id, capability]),
);

/**
 * The capability with this id, or undefined.
 *
 * @example
 * capabilityById("tasks.tasks.read:all")?.sourceRoles;
 */
export function capabilityById(id: string): GrantableCapability | undefined {
  return BY_ID.get(id);
}

/**
 * The capabilities a custom (non-system) role may hold: staff-only and not escalation-locked. The
 * Super-Admin editor offers these.
 *
 * @example
 * const pickList = assignableCapabilities();
 */
export function assignableCapabilities(): readonly GrantableCapability[] {
  return GRANTABLE_CAPABILITIES.filter(
    (capability) => capability.isStaffOnly && !capability.isEscalationLocked,
  );
}

function isAssignable(
  capability: GrantableCapability | undefined,
): capability is GrantableCapability {
  return capability !== undefined && capability.isStaffOnly && !capability.isEscalationLocked;
}

/**
 * The outcome of resolving a custom role's stored capability ids: the grant map to hand the engine as
 * `PolicyPrincipal.resolvedGrants`, the system roles the grants were borrowed from (for the later
 * visibility step), and the ids that were refused (unknown or not assignable), to log.
 */
export interface ResolvedCustomGrants {
  readonly grants: ReadonlyMap<string, readonly RoleGrant[]>;
  readonly derivedRoles: readonly StaffRole[];
  readonly rejected: readonly string[];
}

/**
 * Resolves a custom role's capability ids into engine grants, fail-closed: an id that is unknown or
 * not assignable is dropped into `rejected` and never enforced (D-036). Because every resolved grant
 * is a capability a system role holds, the result is a subset of the system roles' matrix grants, so
 * a custom role can never exceed them.
 *
 * @example
 * const { grants } = resolveCustomGrants(role.capabilityIds);
 * decide({ type: "staff", userId, roles: [], resolvedGrants: grants }, key, target);
 */
export function resolveCustomGrants(capabilityIds: readonly string[]): ResolvedCustomGrants {
  const resolved: GrantableCapability[] = [];
  const derived = new Set<StaffRole>();
  const rejected: string[] = [];
  for (const id of capabilityIds) {
    const capability = BY_ID.get(id);
    if (!isAssignable(capability)) {
      rejected.push(id);
      continue;
    }
    resolved.push(capability);
    for (const role of capability.sourceRoles) derived.add(role);
  }
  return { grants: compileGrants(resolved), derivedRoles: [...derived], rejected };
}
