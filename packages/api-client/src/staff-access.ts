import { useMemo } from "react";
import type { CustomRoleRef, MeResponse } from "@ampm/core";
import {
  STAFF_ROLES,
  can,
  holdsKey,
  resolveCustomGrants,
  type PolicyPrincipal,
} from "@ampm/policy";

import { useMe } from "./hooks/use-me";

/** The part of `/me` a staff member's rights come from. */
export type StaffAccessSource = Pick<MeResponse, "principal" | "roles" | "customCapabilities">;

/**
 * What the signed-in staff member may do, decided by @ampm/policy from the same inputs the API
 * decides with: the system roles (the matrix) plus the custom roles' capabilities as the server
 * resolved them (D-164). Hiding a control is a convenience; the server stays the real gate.
 */
export interface StaffAccess {
  /**
   * The key on every record: `can` with no project and no target. For an action on a route that names
   * no wedding (an account, a lead, a configuration), where a grant scoped to the person's own
   * weddings would be refused.
   */
  can(key: string): boolean;
  /**
   * The key in any scope, with no conditions: `holdsKey`. For showing an area whose records the person
   * can reach some of (a project manager's enquiries).
   */
  holds(key: string): boolean;
}

const NONE: StaffAccess = { can: () => false, holds: () => false };

/**
 * The engine's view of a signed-in staff member, built as the API builds it (less the projects, which
 * no check in the app names): the custom capability ids go through `resolveCustomGrants`, which drops
 * any the bundled catalogue does not know, so a web build older than the API hides a control rather
 * than showing one. Null for anyone not staff.
 *
 * @example
 * const principal = staffPolicyPrincipal(me); // { type: "staff", roles, resolvedGrants, ... } | null
 */
export function staffPolicyPrincipal(me: StaffAccessSource): PolicyPrincipal | null {
  if (me.principal.type !== "staff") return null;
  const { grants } = resolveCustomGrants(me.customCapabilities);
  return {
    type: "staff",
    userId: me.principal.userId,
    roles: me.roles,
    resolvedGrants: grants.size > 0 ? grants : undefined,
  };
}

/**
 * A staff member's access from their `/me`; nothing before it answers or for anyone not staff.
 *
 * @example
 * staffAccessFor(me).can("crm.accounts.update"); // the hub's edit actions
 * staffAccessFor(me).holds("crm.leads.read"); // the Leads & Clients area
 */
export function staffAccessFor(me: StaffAccessSource | undefined): StaffAccess {
  const principal = me ? staffPolicyPrincipal(me) : null;
  if (!principal) return NONE;
  return {
    can: (key) => can(principal, key),
    holds: (key) => holdsKey(principal, key),
  };
}

/**
 * A staff member's roles as they read on screen: the system roles' names (STAFF_ROLES), then the custom
 * roles' (D-164), each with a key for a list. A custom role reads as its name, never its generated key.
 *
 * @example
 * staffRoleNames(me).map((role) => role.name).join(", "); // "Sales / Relationship Manager, Sales assistant"
 */
export function staffRoleNames(me: Pick<MeResponse, "roles" | "customRoles">): CustomRoleRef[] {
  return [
    ...me.roles.map((code) => ({ key: code, name: STAFF_ROLES[code].name })),
    ...me.customRoles,
  ];
}

/**
 * The signed-in staff member's access, from `/me` (`staffAccessFor`): every staff screen's gate, so
 * a custom role's grants show their areas and actions as the system roles' do (D-164). Denies all
 * until `/me` answers.
 *
 *   const access = useStaffAccess();
 *   const canEdit = access.can("crm.accounts.update");
 */
export function useStaffAccess(): StaffAccess {
  const me = useMe();
  return useMemo(() => staffAccessFor(me.data), [me.data]);
}
