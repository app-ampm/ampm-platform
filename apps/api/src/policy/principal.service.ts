import { Inject, Injectable } from "@nestjs/common";
import { errors } from "@ampm/core";
import {
  can,
  resolveClientEntitlements,
  resolveCustomGrants,
  roleFromKey,
  type Entitlements,
  type RoleGrant,
  type StaffRole,
} from "@ampm/policy";

import { AppLogger } from "../common/logger.service.js";
import { ENV, type Env } from "../env.js";
import type { SubscriptionStatus } from "../generated/prisma/client.js";
import type { VerifiedIdentity } from "../identity/identity.types.js";
import { EntitlementCache } from "./entitlement.cache.js";
import {
  PrincipalRepository,
  type PrincipalRecord,
  type PrincipalRole,
} from "./principal.repository.js";
import type { Principal } from "./principal.types.js";

type ResolvedGrants = ReadonlyMap<string, readonly RoleGrant[]>;

/** What a staff user's roles authorise: the system roles by code, and their custom roles' grants. */
interface StaffAuthority {
  readonly roles: StaffRole[];
  readonly resolvedGrants: ResolvedGrants | undefined;
}

/** A staff member as a picker shows them. */
export interface StaffMember {
  readonly id: string;
  readonly name: string;
}

/** Splits held roles into the nine system codes and the ids of the custom roles. */
function splitRoles(held: readonly PrincipalRole[]): {
  roles: StaffRole[];
  customRoleIds: string[];
} {
  const roles: StaffRole[] = [];
  const customRoleIds: string[] = [];
  for (const role of held) {
    const code = roleFromKey(role.roleKey);
    // One of the nine only when it is both a known code AND flagged system; a non-system role that
    // reused a reserved key resolves fail-closed through its own grants, never the matrix role's.
    if (code !== undefined && role.isSystem) roles.push(code);
    else customRoleIds.push(role.roleId);
  }
  return { roles, customRoleIds };
}

/**
 * Steps 2 and 3 of the pipeline: a verified identity becomes a principal from the API's own
 * records; client and demo principals also get their entitlements (cached five minutes). A staff
 * user's custom roles (D-036) resolve to the engine's `resolvedGrants` when DYNAMIC_ROLES is on.
 * No account for the subject means no access: there is no self-registration (A-13).
 *
 * @example
 * const principal = await this.principals.resolve(identity);
 */
@Injectable()
export class PrincipalService {
  private readonly entitlements = new EntitlementCache();

  constructor(
    private readonly repository: PrincipalRepository,
    @Inject(ENV) private readonly env: Env,
    private readonly logger: AppLogger,
  ) {}

  async resolve(identity: VerifiedIdentity, now: Date = new Date()): Promise<Principal> {
    const record = await this.repository.findByIdentitySubject(identity.subject);
    if (!record) throw errors.unauthenticated("No account for this sign-in");
    if (record.status !== "active") throw errors.unauthenticated("This account is not active");
    void this.repository.touchLastLogin(record.id, now).catch(() => undefined);
    const base = {
      userId: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      status: record.status,
      lastLoginAt: record.lastLoginAt,
      memberships: record.memberships,
    };
    if (record.userType === "staff") {
      const { roles, resolvedGrants } = await this.staffAuthority(record.id, record.roles);
      return { type: "staff", roles, resolvedGrants, ...base };
    }
    const entitlements = await this.entitlementsFor(record);
    return { type: record.userType, entitlements, ...base };
  }

  invalidateEntitlements(userId: string): void {
    this.entitlements.invalidate(userId);
  }

  /**
   * The active staff whose roles grant `key` on every record — the people a record of that kind can be
   * handed to (an enquiry's owner, say). Decided by the same engine and the same role resolution as a
   * signed-in request, custom roles included when DYNAMIC_ROLES is on; a grant scoped to the holder's own
   * weddings or records does not count, since it would not reach an arbitrary record. Only those among
   * `userIds` when given, so one candidate can be checked. By name.
   *
   * @example
   * const owners = await this.principals.staffHolding("consultancy.enquiries.update");
   */
  async staffHolding(key: string, userIds?: readonly string[]): Promise<StaffMember[]> {
    const staff = await this.repository.activeStaff(userIds);
    const holding: StaffMember[] = [];
    for (const member of staff) {
      const { roles, resolvedGrants } = await this.staffAuthority(member.id, member.roles);
      // No projects and no target: only an all-records grant reaches here.
      if (can({ type: "staff", userId: member.id, roles, resolvedGrants, projectIds: [] }, key)) {
        holding.push({ id: member.id, name: member.name });
      }
    }
    return holding;
  }

  private async staffAuthority(
    userId: string,
    held: readonly PrincipalRole[],
  ): Promise<StaffAuthority> {
    const { roles, customRoleIds } = splitRoles(held);
    return { roles, resolvedGrants: await this.customGrantsFor(userId, customRoleIds) };
  }

  /**
   * The grants a staff user's custom roles contribute to `decide()` (D-036), resolved fresh each
   * request from `role_grants` through the code catalog (fail-closed). Off unless DYNAMIC_ROLES is on,
   * and a user with no custom roles costs no extra query. Resolving per request — rather than caching —
   * keeps a demotion effective at once: a role change revokes the user's sessions, and their next
   * request re-reads the grants, so there is nothing stale to invalidate.
   *
   * Phase 5 (D-037): these grants drive key-level authorization only, not field visibility, which is
   * still role-switch-based. So a custom role granted a classified-field read passes `decide()` but the
   * serialiser still strips the field (fail-safe); reading restricted classes through a custom role
   * awaits the capability-driven visibility step.
   */
  private async customGrantsFor(
    userId: string,
    customRoleIds: readonly string[],
  ): Promise<ResolvedGrants | undefined> {
    if (!this.env.DYNAMIC_ROLES || customRoleIds.length === 0) return undefined;
    const keys = await this.repository.capabilityKeysForRoles(customRoleIds);
    const { grants, rejected } = resolveCustomGrants(keys);
    if (rejected.length > 0) {
      // A stored grant outside the catalog is dropped, never enforced; surface it rather than hide it.
      this.logger.warn("principal.custom_grants.rejected", { userId, count: rejected.length });
    }
    return grants.size > 0 ? grants : undefined;
  }

  private async entitlementsFor(record: PrincipalRecord): Promise<Entitlements> {
    const cached = this.entitlements.get(record.id);
    if (cached) return cached;
    // The subscription dimension now comes from module B (feature 8.3): a client's account subscription
    // status. Agreements still await module C/D. A project's status (on hold, closed) lives in
    // wedding_projects (module E); until then an active membership is an active project.
    const subscription =
      record.userType === "client"
        ? effectiveSubscription(await this.repository.accountSubscriptionStatuses(record.id))
        : "none";
    const entitlements = resolveClientEntitlements({
      isDemo: record.userType === "demo",
      suspended: false,
      subscription,
      // An active hotel-assistance agreement grants the module (data-model §4, feature 10.2, GP-5).
      hotelAssistanceAgreement:
        record.userType === "client"
          ? await this.repository.accountHasActiveHotelAgreement(record.id)
          : false,
      project: record.memberships.length > 0 ? "active" : "none",
    });
    this.entitlements.set(record.id, entitlements);
    return entitlements;
  }
}

/** The subscription state the entitlement engine reads (permission-matrix §3). */
type SubscriptionEntitlementState =
  "none" | "active" | "expired" | "cancelled" | "suspended" | "trial";

/**
 * Reduce an account's subscription rows to the single state §3 scores. An active (or expiring, still
 * within term) subscription grants its modules; a lapsed one (expired/cancelled/suspended) keeps only
 * the read-only lapsed set; a `pending_payment` (unpaid) or no subscription grants nothing (AC-02.3).
 * A renewal is a new row, so the strongest state across the account's subscriptions wins (AC-02.11).
 */
function effectiveSubscription(
  statuses: readonly SubscriptionStatus[],
): SubscriptionEntitlementState {
  if (statuses.some((status) => status === "active" || status === "expiring")) return "active";
  if (statuses.includes("trial")) return "trial";
  if (statuses.includes("suspended")) return "suspended";
  if (statuses.includes("cancelled")) return "cancelled";
  if (statuses.includes("expired")) return "expired";
  return "none";
}
