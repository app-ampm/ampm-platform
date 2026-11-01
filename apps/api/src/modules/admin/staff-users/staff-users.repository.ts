import { Injectable } from "@nestjs/common";
import type { UserStatus } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/** A staff user as the admin surface reads it — never the identity subject or any token. */
export interface StaffUserRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly status: UserStatus;
  readonly mfaEnabled: boolean;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly roleKeys: readonly string[];
}

export abstract class StaffUsersRepository {
  abstract create(
    data: {
      readonly name: string;
      readonly email: string;
      readonly phone: string | undefined;
      readonly createdBy: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<{ id: string }>;
  abstract update(
    id: string,
    data: { readonly name?: string; readonly phone?: string | null; readonly mfaEnabled?: boolean },
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract setStatus(
    id: string,
    status: UserStatus,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract softDelete(
    id: string,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract findById(id: string): Promise<StaffUserRow | null>;
  abstract list(
    limit: number,
    cursor: string | undefined,
    status: UserStatus | undefined,
  ): Promise<{ rows: StaffUserRow[]; nextCursor: string | null }>;
  /** True when a LIVE (non-deleted) user already holds this email; a soft-deleted holder frees it (B9). */
  abstract emailExists(email: string): Promise<boolean>;
  /** True when the user has linked an identity subject (has activated) — used to gate re-activation (B4). */
  abstract isActivated(id: string): Promise<boolean>;
}

const WITH_ROLES = {
  roles: { select: { role: { select: { roleKey: true } } } },
} as const;

type UserWithRoles = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: { role: { roleKey: string } }[];
};

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  ...WITH_ROLES,
} as const;

function toRow(user: UserWithRoles): StaffUserRow {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roleKeys: user.roles.map((entry) => entry.role.roleKey),
  };
}

@Injectable()
export class PrismaStaffUsersRepository extends StaffUsersRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    data: { name: string; email: string; phone: string | undefined; createdBy: string },
    client: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    return client.user.create({
      data: {
        userType: "staff",
        name: data.name,
        email: data.email,
        status: "invited",
        createdBy: data.createdBy,
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
      select: { id: true },
    });
  }

  async update(
    id: string,
    data: { name?: string; phone?: string | null; mfaEnabled?: boolean },
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const patch: Prisma.UserUpdateInput = { updatedBy };
    if (data.name !== undefined) patch.name = data.name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.mfaEnabled !== undefined) patch.mfaEnabled = data.mfaEnabled;
    await client.user.update({ where: { id }, data: patch });
  }

  async setStatus(
    id: string,
    status: UserStatus,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.user.update({ where: { id }, data: { status, updatedBy } });
  }

  async softDelete(id: string, updatedBy: string, client: Prisma.TransactionClient): Promise<void> {
    await client.user.update({ where: { id }, data: { deletedAt: new Date(), updatedBy } });
  }

  async findById(id: string): Promise<StaffUserRow | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, userType: "staff", deletedAt: null },
      select: SELECT,
    });
    return user ? toRow(user) : null;
  }

  async list(
    limit: number,
    cursor: string | undefined,
    status: UserStatus | undefined,
  ): Promise<{ rows: StaffUserRow[]; nextCursor: string | null }> {
    const where: Prisma.UserWhereInput = { userType: "staff", deletedAt: null };
    if (status !== undefined) where.status = status;
    if (cursor) where.id = { lt: cursor };
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
      select: SELECT,
    });
    const hasMore = users.length > limit;
    const pageRows = hasMore ? users.slice(0, limit) : users;
    const last = pageRows[pageRows.length - 1];
    return { rows: pageRows.map(toRow), nextCursor: hasMore && last ? last.id : null };
  }

  async emailExists(email: string): Promise<boolean> {
    // Only a LIVE holder blocks the email; a soft-deleted user frees it (B9, partial unique index).
    const count = await this.prisma.user.count({ where: { email, deletedAt: null } });
    return count > 0;
  }

  async isActivated(id: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id, userType: "staff", deletedAt: null },
      select: { identitySubject: true },
    });
    return user?.identitySubject != null;
  }
}
