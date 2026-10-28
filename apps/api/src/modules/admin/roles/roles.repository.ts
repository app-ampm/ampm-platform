import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/** A role with the capability keys it grants directly (permission sets land in slice 6b). */
export interface RoleRow {
  readonly id: string;
  readonly roleKey: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly capabilityKeys: readonly string[];
}

export abstract class RolesRepository {
  abstract create(
    data: { readonly name: string; readonly roleKey: string; readonly createdBy: string },
    client: Prisma.TransactionClient,
  ): Promise<{ id: string }>;
  abstract rename(
    id: string,
    name: string,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  /** Replaces a role's direct grants with the catalog capabilities named by key. */
  abstract setGrants(
    roleId: string,
    capabilityKeys: readonly string[],
    createdBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract softDelete(
    id: string,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract findById(id: string): Promise<RoleRow | null>;
  abstract listCustom(): Promise<RoleRow[]>;
  abstract userIdsWithRole(roleId: string): Promise<string[]>;
  abstract assign(userId: string, roleId: string, client: Prisma.TransactionClient): Promise<void>;
  abstract unassign(
    userId: string,
    roleId: string,
    client: Prisma.TransactionClient,
  ): Promise<number>;
  abstract userExists(userId: string): Promise<boolean>;
}

const WITH_GRANTS = {
  grants: { select: { capability: { select: { capabilityKey: true } } } },
} as const;

type RoleWithGrants = {
  id: string;
  roleKey: string;
  name: string;
  isSystem: boolean;
  grants: { capability: { capabilityKey: string } }[];
};

function toRow(role: RoleWithGrants): RoleRow {
  return {
    id: role.id,
    roleKey: role.roleKey,
    name: role.name,
    isSystem: role.isSystem,
    capabilityKeys: role.grants.map((grant) => grant.capability.capabilityKey),
  };
}

@Injectable()
export class PrismaRolesRepository extends RolesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    data: { name: string; roleKey: string; createdBy: string },
    client: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    const role = await client.role.create({
      data: { roleKey: data.roleKey, name: data.name, isSystem: false, createdBy: data.createdBy },
      select: { id: true },
    });
    return role;
  }

  async rename(
    id: string,
    name: string,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.role.update({ where: { id }, data: { name, updatedBy } });
  }

  async setGrants(
    roleId: string,
    capabilityKeys: readonly string[],
    createdBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.roleGrant.deleteMany({ where: { roleId } });
    const wanted = [...new Set(capabilityKeys)];
    if (wanted.length === 0) return;
    const capabilities = await client.grantableCapability.findMany({
      where: { capabilityKey: { in: wanted } },
      select: { id: true, capabilityKey: true },
    });
    // The service has already validated every key against the code catalog, so a shortfall means the
    // grantable_capabilities table is behind the catalog. Fail closed and surface the drift rather than
    // silently persist a partial grant (which would also make the audit's after-image a lie).
    if (capabilities.length !== wanted.length) {
      const found = new Set(capabilities.map((capability) => capability.capabilityKey));
      const missing = wanted.filter((key) => !found.has(key));
      throw new Error(
        `grantable_capabilities is missing ${missing.length} catalog capability(ies) [${missing.join(", ")}]; run the seed (pnpm --filter api db:seed)`,
      );
    }
    await client.roleGrant.createMany({
      data: capabilities.map((capability) => ({
        roleId,
        grantableCapabilityId: capability.id,
        createdBy,
      })),
    });
  }

  async softDelete(id: string, updatedBy: string, client: Prisma.TransactionClient): Promise<void> {
    await client.role.update({ where: { id }, data: { deletedAt: new Date(), updatedBy } });
  }

  async findById(id: string): Promise<RoleRow | null> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, roleKey: true, name: true, isSystem: true, ...WITH_GRANTS },
    });
    return role ? toRow(role) : null;
  }

  async listCustom(): Promise<RoleRow[]> {
    const roles = await this.prisma.role.findMany({
      where: { isSystem: false, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, roleKey: true, name: true, isSystem: true, ...WITH_GRANTS },
    });
    return roles.map(toRow);
  }

  async userIdsWithRole(roleId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  async assign(userId: string, roleId: string, client: Prisma.TransactionClient): Promise<void> {
    await client.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  async unassign(
    userId: string,
    roleId: string,
    client: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await client.userRole.deleteMany({ where: { userId, roleId } });
    return result.count;
  }

  async userExists(userId: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { id: userId, deletedAt: null } });
    return count > 0;
  }
}
