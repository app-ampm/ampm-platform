import { Injectable } from "@nestjs/common";
import { errors } from "@ampm/core";
import {
  resolveClientEntitlements,
  roleFromKey,
  type Entitlements,
  type StaffRole,
} from "@ampm/policy";

import type { VerifiedIdentity } from "../identity/identity.types.js";
import { EntitlementCache } from "./entitlement.cache.js";
import { PrincipalRepository, type PrincipalRecord } from "./principal.repository.js";
import type { Principal } from "./principal.types.js";

/**
 * Steps 2 and 3 of the pipeline: a verified identity becomes a principal from the API's own
 * records; client and demo principals also get their entitlements (cached five minutes).
 * No account for the subject means no access: there is no self-registration (A-13).
 *
 * @example
 * const principal = await this.principals.resolve(identity);
 */
@Injectable()
export class PrincipalService {
  private readonly cache = new EntitlementCache();

  constructor(private readonly repository: PrincipalRepository) {}

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
      const roles = record.roleKeys
        .map(roleFromKey)
        .filter((role): role is StaffRole => role !== undefined);
      return { type: "staff", roles, ...base };
    }
    const entitlements = this.entitlementsFor(record);
    return { type: record.userType, entitlements, ...base };
  }

  invalidateEntitlements(userId: string): void {
    this.cache.invalidate(userId);
  }

  private entitlementsFor(record: PrincipalRecord): Entitlements {
    const cached = this.cache.get(record.id);
    if (cached) return cached;
    // Subscriptions and agreements arrive with module B; until then membership is the only source.
    // A project's status (on hold, closed within the window) lives in wedding_projects, which
    // arrives with module E: until then no membership can be on hold or closed, so an active one
    // is an active project. Derive the strongest project state here when that table exists.
    const entitlements = resolveClientEntitlements({
      isDemo: record.userType === "demo",
      suspended: false,
      subscription: "none",
      hotelAssistanceAgreement: false,
      project: record.memberships.length > 0 ? "active" : "none",
    });
    this.cache.set(record.id, entitlements);
    return entitlements;
  }
}
