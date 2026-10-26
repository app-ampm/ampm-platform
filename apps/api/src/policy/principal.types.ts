import type { Entitlements, PolicyPrincipal, StaffRole } from "@ampm/policy";
import type { Membership } from "@ampm/core";

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
  readonly roles: readonly StaffRole[];
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
    projectIds: principal.memberships.map((m) => m.projectId),
  };
}
