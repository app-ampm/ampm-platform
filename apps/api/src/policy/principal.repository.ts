import { Injectable } from "@nestjs/common";

import { PrismaService } from "../db/prisma.service.js";

/** The one query the pipeline needs: the account behind an identity subject, with roles and memberships. */
export interface PrincipalRecord {
  readonly id: string;
  readonly userType: "staff" | "client" | "demo";
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly status: "invited" | "active" | "disabled" | "locked";
  readonly lastLoginAt: Date | null;
  readonly roleKeys: readonly string[];
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
        roles: { include: { role: true } },
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
      roleKeys: user.roles.map((entry) => entry.role.roleKey),
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
}
