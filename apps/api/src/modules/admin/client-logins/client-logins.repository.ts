import { Injectable } from "@nestjs/common";
import type { ClientSide, MembershipStatus, UserStatus } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/** One client-representative login — the user joined with its membership of one wedding. */
export interface ClientLoginRow {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly userStatus: UserStatus;
  readonly membershipId: string;
  readonly clientSide: ClientSide | null;
  readonly canViewFinance: boolean;
  readonly canApprove: boolean;
  readonly membershipStatus: MembershipStatus;
  readonly invitedAt: Date | null;
}

export abstract class ClientLoginsRepository {
  abstract createClientWithMembership(
    data: {
      readonly projectId: string;
      readonly name: string;
      readonly email: string;
      readonly phone: string | undefined;
      readonly clientSide: ClientSide;
      readonly canViewFinance: boolean;
      readonly canApprove: boolean;
      readonly createdBy: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<{ userId: string; membershipId: string }>;
  abstract listByProject(projectId: string): Promise<ClientLoginRow[]>;
  abstract findMembership(projectId: string, userId: string): Promise<ClientLoginRow | null>;
  abstract updateFlags(
    membershipId: string,
    flags: { readonly canViewFinance?: boolean; readonly canApprove?: boolean },
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract removeMembership(
    membershipId: string,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract emailExists(email: string): Promise<boolean>;
  /** The sides already taken by live (non-removed) client reps of the wedding, for the Q5 cap. */
  abstract liveRepSides(projectId: string): Promise<(ClientSide | null)[]>;
}

type MemberWithUser = {
  id: string;
  clientSide: ClientSide | null;
  canViewFinance: boolean;
  canApprove: boolean;
  status: MembershipStatus;
  invitedAt: Date | null;
  user: { id: string; name: string; email: string; phone: string | null; status: UserStatus };
};

const WITH_USER = {
  select: {
    id: true,
    clientSide: true,
    canViewFinance: true,
    canApprove: true,
    status: true,
    invitedAt: true,
    user: { select: { id: true, name: true, email: true, phone: true, status: true } },
  },
} as const;

function toRow(member: MemberWithUser): ClientLoginRow {
  return {
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    phone: member.user.phone,
    userStatus: member.user.status,
    membershipId: member.id,
    clientSide: member.clientSide,
    canViewFinance: member.canViewFinance,
    canApprove: member.canApprove,
    membershipStatus: member.status,
    invitedAt: member.invitedAt,
  };
}

@Injectable()
export class PrismaClientLoginsRepository extends ClientLoginsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createClientWithMembership(
    data: {
      projectId: string;
      name: string;
      email: string;
      phone: string | undefined;
      clientSide: ClientSide;
      canViewFinance: boolean;
      canApprove: boolean;
      createdBy: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<{ userId: string; membershipId: string }> {
    const user = await client.user.create({
      data: {
        userType: "client",
        name: data.name,
        email: data.email,
        status: "invited",
        createdBy: data.createdBy,
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
      select: { id: true },
    });
    const membership = await client.projectMember.create({
      data: {
        projectId: data.projectId,
        userId: user.id,
        projectRole: "client_representative",
        clientSide: data.clientSide,
        canViewFinance: data.canViewFinance,
        canApprove: data.canApprove,
        status: "invited",
        invitedAt: new Date(),
        createdBy: data.createdBy,
      },
      select: { id: true },
    });
    return { userId: user.id, membershipId: membership.id };
  }

  async listByProject(projectId: string): Promise<ClientLoginRow[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId, projectRole: "client_representative", deletedAt: null },
      orderBy: { createdAt: "asc" },
      ...WITH_USER,
    });
    return members.map(toRow);
  }

  async findMembership(projectId: string, userId: string): Promise<ClientLoginRow | null> {
    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, userId, projectRole: "client_representative", deletedAt: null },
      ...WITH_USER,
    });
    return member ? toRow(member) : null;
  }

  async updateFlags(
    membershipId: string,
    flags: { canViewFinance?: boolean; canApprove?: boolean },
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const data: Prisma.ProjectMemberUpdateInput = { updatedBy };
    if (flags.canViewFinance !== undefined) data.canViewFinance = flags.canViewFinance;
    if (flags.canApprove !== undefined) data.canApprove = flags.canApprove;
    await client.projectMember.update({ where: { id: membershipId }, data });
  }

  async removeMembership(
    membershipId: string,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.projectMember.update({
      where: { id: membershipId },
      data: { status: "removed", deletedAt: new Date(), updatedBy },
    });
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async liveRepSides(projectId: string): Promise<(ClientSide | null)[]> {
    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId,
        projectRole: "client_representative",
        deletedAt: null,
        status: { not: "removed" },
      },
      select: { clientSide: true },
    });
    return members.map((member) => member.clientSide);
  }
}
