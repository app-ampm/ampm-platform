import { errors, type CapabilityView } from "@ampm/core";
import {
  GRANTABLE_CAPABILITIES,
  assignableCapabilities,
  capabilityById,
  roleFromKey,
  type GrantableCapability,
} from "@ampm/policy";

import type { Principal } from "../../policy/principal.types.js";

/**
 * The guardrails shared by the two things a Super Admin can grant catalog capabilities to — custom
 * roles (slice 6a) and reusable permission sets (slice 6b). Keeping the escalation-lock check in one
 * place means there is a single write-time gate to audit; resolution (resolveCustomGrants) re-checks
 * the same rule fail-closed, so a grant that ever slipped past is still never enforced (D-036).
 */

/** The view of one grantable capability for the Super-Admin editor. */
export function toCapabilityView(capability: GrantableCapability): CapabilityView {
  return {
    id: capability.id,
    module: capability.module,
    resource: capability.resource,
    action: capability.action,
    scope: capability.scope,
    label: capability.label,
    isEscalationLocked: capability.isEscalationLocked,
    sourceRoles: [...capability.sourceRoles],
  };
}

/** The pick-list: every capability a custom role or permission set may hold. */
export function assignableCapabilityViews(): CapabilityView[] {
  return assignableCapabilities().map(toCapabilityView);
}

/** Views for stored capability keys, dropping any no longer in the catalog (fail-safe for drift). */
export function capabilityViewsForKeys(keys: readonly string[]): CapabilityView[] {
  return keys
    .map((key) => capabilityById(key))
    .filter((capability): capability is GrantableCapability => capability !== undefined)
    .map(toCapabilityView);
}

/**
 * The capability views a *system* role holds, resolved from the matrix catalog by its source role.
 * A system role carries no stored `role_grants` — its power lives in the matrix (D-036) — so unlike a
 * custom role its capabilities cannot be read from the database; they are every catalog capability
 * whose `sourceRoles` include this role. Includes the escalation-locked ones a custom role could never
 * borrow, because this is the read model the Super Admin uses to see what a built-in role can do. An
 * unknown key (catalog drift) yields an empty list, never a throw.
 */
export function capabilityViewsForRole(roleKey: string): CapabilityView[] {
  const code = roleFromKey(roleKey);
  if (code === undefined) return [];
  return GRANTABLE_CAPABILITIES.filter((capability) => capability.sourceRoles.includes(code)).map(
    toCapabilityView,
  );
}

/**
 * Rejects any capability id that is not in the catalog (validation) or is not assignable — staff-only
 * and not escalation-locked (forbidden). The single write-time gate for both roles and permission sets.
 */
export function assertAssignable(capabilityIds: readonly string[]): void {
  const allowed = new Set(assignableCapabilities().map((capability) => capability.id));
  for (const id of capabilityIds) {
    if (!capabilityById(id)) {
      throw errors.validation([{ path: "capabilityIds", message: `unknown capability "${id}"` }]);
    }
    if (!allowed.has(id)) {
      throw errors.forbidden(
        `capability "${id}" cannot be granted to a custom role or permission set`,
      );
    }
  }
}

/**
 * A system role or permission set may carry escalation-locked power that a custom one never can, so
 * handing one out is itself a Super-Admin-grade act. Gating on the Super Admin role — not on a
 * capability a lesser role could hold — keeps the surface safe even if admin.staff_users.update is ever
 * delegated to a lower staff admin.
 */
export function isSuperAdmin(principal: Principal): boolean {
  return principal.type === "staff" && principal.roles.includes("SA");
}
