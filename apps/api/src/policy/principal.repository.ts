import { Injectable } from "@nestjs/common";

import { PrismaService } from "../db/prisma.service.js";
import type { SubscriptionStatus } from "../generated/prisma/client.js";

/** A role the user holds: its key and id, and whether it is one of the nine matrix-driven system roles. */
export interface PrincipalRole {
  readonly roleKey: string;
  readonly roleId: string;
  readonly isSystem: boolean;
}

/** The one query the pipeline needs: the account behind an identity subject, with roles and memberships. */
export interface PrincipalRecord {
  readonly id: string;
  readonly userType: "staff" | "client" | "demo";
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly status: "invited" | "active" | "disabled" | "locked";
  readonly lastLoginAt: Date | null;
  readonly roles: readonly PrincipalRole[];
  readonly memberships: readonly {
    readonly projectId: string;
    readonly projectRole: "project_lead" | "staff" | "client_representative";
    readonly clientSide: "bride" | "groom" | null;
    readonly canViewFinance: boolean;
    readonly canApprove: boolean;
  }[];
}

export abstract class PrincipalRepository {
  abstract findByIdentitySubject(subject: string): Promise<PrincipalRecord | null>;
  abstract touchLastLogin(userId: string, at: Date): Promise<void>;
  /** The capability keys a custom role grants, directly and through its permission sets (D-036). */
  abstract capabilityKeysForRoles(roleIds: readonly string[]): Promise<string[]>;
  /** The statuses of the subscriptions on the account a client user belongs to (feature 8.3 gating). */
  abstract accountSubscriptionStatuses(userId: string): Promise<SubscriptionStatus[]>;
}

@Injectable()
export class PrismaPrincipalRepository extends PrincipalRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByIdentitySubject(subject: string): Promise<PrincipalRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { identitySubject: subject, deletedAt: null },
      include: {
        // A soft-deleted role grants nothing (architecture §8: deleted rows are excluded from every read).
        roles: { where: { role: { deletedAt: null } }, include: { role: true } },
        memberships: { where: { status: "active", deletedAt: null } },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      userType: user.userType,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map((entry) => ({
        roleKey: entry.role.roleKey,
        roleId: entry.role.id,
        isSystem: entry.role.isSystem,
      })),
      memberships: user.memberships.map((m) => ({
        projectId: m.projectId,
        projectRole: m.projectRole,
        clientSide: m.clientSide,
        canViewFinance: m.canViewFinance,
        canApprove: m.canApprove,
      })),
    };
  }

  async touchLastLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  /**
   * The subscription statuses on the account a client user belongs to (via its account contact). Drives
   * the subscription dimension of the client's entitlements (feature 8.3); empty when the user is on no
   * account or the account has no subscription, which grants nothing extra.
   */
  async accountSubscriptionStatuses(userId: string): Promise<SubscriptionStatus[]> {
    const contact = await this.prisma.accountContact.findFirst({
      where: { userId, deletedAt: null },
      select: { accountId: true },
    });
    if (!contact) return [];
    const subscriptions = await this.prisma.subscription.findMany({
      where: { accountId: contact.accountId, deletedAt: null },
      select: { status: true },
    });
    return subscriptions.map((subscription) => subscription.status);
  }

  async capabilityKeysForRoles(roleIds: readonly string[]): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const ids = [...roleIds];
    const [direct, viaSets] = await Promise.all([
      this.prisma.roleGrant.findMany({
        where: { roleId: { in: ids } },
        select: { capability: { select: { capabilityKey: true } } },
      }),
      this.prisma.rolePermissionSet.findMany({
        // A soft-deleted set grants nothing (architecture §8).
        where: { roleId: { in: ids }, permissionSet: { deletedAt: null } },
        select: {
          permissionSet: {
            select: { grants: { select: { capability: { select: { capabilityKey: true } } } } },
          },
        },
      }),
    ]);
    const keys = new Set<string>();
    for (const grant of direct) keys.add(grant.capability.capabilityKey);
    for (const link of viaSets) {
      for (const grant of link.permissionSet.grants) keys.add(grant.capability.capabilityKey);
    }
    return [...keys];
  }
}
