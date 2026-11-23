import type { Entitlements, PolicyPrincipal, RoleGrant, StaffRole } from "@ampm/policy";
import type { CustomRoleRef, Membership } from "@ampm/core";

/** Step 2 of the pipeline: who is calling, from the API's records (architecture §6). */
interface UserPrincipalBase {
  readonly userId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: "invited" | "active" | "disabled" | "locked";
  readonly lastLoginAt: Date | null;
  readonly memberships: readonly Membership[];
}

export interface StaffPrincipal extends UserPrincipalBase {
  readonly type: "staff";
  /** The system roles the user holds (the nine), matrix-driven. */
  readonly roles: readonly StaffRole[];
  /** Grants resolved from the user's custom roles (D-036), keyed by base key; set only when DYNAMIC_ROLES is on. */
  readonly resolvedGrants?: ReadonlyMap<string, readonly RoleGrant[]> | undefined;
  /** The custom roles in effect (D-036): none while DYNAMIC_ROLES is off. For `/me` (D-164). */
  readonly customRoles?: readonly CustomRoleRef[] | undefined;
  /**
   * The catalogue capability ids behind `resolvedGrants`, sorted, the ones the catalogue refused left
   * out: `/me` hands them to the app, which compiles them as the server did (D-164).
   */
  readonly customCapabilities?: readonly string[] | undefined;
}

export interface ClientPrincipal extends UserPrincipalBase {
  readonly type: "client";
  readonly entitlements: Entitlements;
}

export interface DemoPrincipal extends UserPrincipalBase {
  readonly type: "demo";
  readonly entitlements: Entitlements;
}

export interface SystemPrincipal {
  readonly type: "system";
  readonly name: string;
}

export type Principal = StaffPrincipal | ClientPrincipal | DemoPrincipal | SystemPrincipal;

/** The engine's view of a principal (policy step 4). */
export function toPolicyPrincipal(principal: Principal): PolicyPrincipal {
  if (principal.type === "system") return { type: "system" };
  return {
    type: principal.type,
    userId: principal.userId,
    roles: principal.type === "staff" ? principal.roles : undefined,
    resolvedGrants: principal.type === "staff" ? principal.resolvedGrants : undefined,
    projectIds: principal.memberships.map((m) => m.projectId),
  };
}
