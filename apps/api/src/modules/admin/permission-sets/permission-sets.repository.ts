import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/** A permission set with the capability keys it grants. */
export interface PermissionSetRow {
  readonly id: string;
  readonly setKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly capabilityKeys: readonly string[];
}

export abstract class PermissionSetsRepository {
  abstract create(
    data: {
      readonly name: string;
      readonly description: string | null;
      readonly setKey: string;
      readonly createdBy: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<{ id: string }>;
  abstract updateMeta(
    id: string,
    meta: { readonly name?: string; readonly description?: string | null },
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  /** Replaces a set's grants with the catalog capabilities named by key. */
  abstract setGrants(
    setId: string,
    capabilityKeys: readonly string[],
    createdBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract softDelete(
    id: string,
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void>;
  abstract findById(id: string): Promise<PermissionSetRow | null>;
  abstract listCustom(): Promise<PermissionSetRow[]>;
  /** The role's existence and system flag, for the attach guardrail; null when missing or deleted. */
  abstract findRole(roleId: string): Promise<{ isSystem: boolean } | null>;
  /** Links a set to a role; returns 1 when newly linked, 0 when it was already attached (idempotent). */
  abstract attach(roleId: string, setId: string, client: Prisma.TransactionClient): Promise<number>;
  abstract detach(roleId: string, setId: string, client: Prisma.TransactionClient): Promise<number>;
  abstract userIdsWithRole(roleId: string): Promise<string[]>;
  /** Everyone affected by a change to this set: holders of any role the set is attached to. */
  abstract userIdsWithSet(setId: string): Promise<string[]>;
}

const WITH_GRANTS = {
  grants: { select: { capability: { select: { capabilityKey: true } } } },
} as const;

type SetWithGrants = {
  id: string;
  setKey: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  grants: { capability: { capabilityKey: string } }[];
};

function toRow(set: SetWithGrants): PermissionSetRow {
  return {
    id: set.id,
    setKey: set.setKey,
    name: set.name,
    description: set.description,
    isSystem: set.isSystem,
    capabilityKeys: set.grants.map((grant) => grant.capability.capabilityKey),
  };
}

@Injectable()
export class PrismaPermissionSetsRepository extends PermissionSetsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    data: { name: string; description: string | null; setKey: string; createdBy: string },
    client: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    return client.permissionSet.create({
      data: {
        setKey: data.setKey,
        name: data.name,
        description: data.description,
        isSystem: false,
        createdBy: data.createdBy,
      },
      select: { id: true },
    });
  }

  async updateMeta(
    id: string,
    meta: { name?: string; description?: string | null },
    updatedBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const data: Prisma.PermissionSetUpdateInput = { updatedBy };
    if (meta.name !== undefined) data.name = meta.name;
    if (meta.description !== undefined) data.description = meta.description;
    await client.permissionSet.update({ where: { id }, data });
  }

  async setGrants(
    setId: string,
    capabilityKeys: readonly string[],
    createdBy: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.permissionSetGrant.deleteMany({ where: { permissionSetId: setId } });
    const wanted = [...new Set(capabilityKeys)];
    if (wanted.length === 0) return;
    const capabilities = await client.grantableCapability.findMany({
      where: { capabilityKey: { in: wanted } },
      select: { id: true, capabilityKey: true },
    });
    // The service validated every key against the code catalog, so a shortfall means the DB catalog is
    // behind; fail closed rather than silently persist a partial set (which would also mislead the audit).
    if (capabilities.length !== wanted.length) {
      const found = new Set(capabilities.map((capability) => capability.capabilityKey));
      const missing = wanted.filter((key) => !found.has(key));
      throw new Error(
        `grantable_capabilities is missing ${missing.length} catalog capability(ies) [${missing.join(", ")}]; run the seed (pnpm --filter api db:seed)`,
      );
    }
    await client.permissionSetGrant.createMany({
      data: capabilities.map((capability) => ({
        permissionSetId: setId,
        grantableCapabilityId: capability.id,
        createdBy,
      })),
    });
  }

  async softDelete(id: string, updatedBy: string, client: Prisma.TransactionClient): Promise<void> {
    await client.permissionSet.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy },
    });
  }

  async findById(id: string): Promise<PermissionSetRow | null> {
    const set = await this.prisma.permissionSet.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        setKey: true,
        name: true,
        description: true,
        isSystem: true,
        ...WITH_GRANTS,
      },
    });
    return set ? toRow(set) : null;
  }

  async listCustom(): Promise<PermissionSetRow[]> {
    const sets = await this.prisma.permissionSet.findMany({
      where: { isSystem: false, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        setKey: true,
        name: true,
        description: true,
        isSystem: true,
        ...WITH_GRANTS,
      },
    });
    return sets.map(toRow);
  }

  async findRole(roleId: string): Promise<{ isSystem: boolean } | null> {
    return this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
      select: { isSystem: true },
    });
  }

  async attach(roleId: string, setId: string, client: Prisma.TransactionClient): Promise<number> {
    const result = await client.rolePermissionSet.createMany({
      data: [{ roleId, permissionSetId: setId }],
      skipDuplicates: true,
    });
    return result.count;
  }

  async detach(roleId: string, setId: string, client: Prisma.TransactionClient): Promise<number> {
    const result = await client.rolePermissionSet.deleteMany({
      where: { roleId, permissionSetId: setId },
    });
    return result.count;
  }

  async userIdsWithRole(roleId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  async userIdsWithSet(setId: string): Promise<string[]> {
    const links = await this.prisma.rolePermissionSet.findMany({
      where: { permissionSetId: setId },
      select: { roleId: true },
    });
    const roleIds = links.map((link) => link.roleId);
    if (roleIds.length === 0) return [];
    const rows = await this.prisma.userRole.findMany({
      where: { roleId: { in: roleIds } },
      select: { userId: true },
    });
    return [...new Set(rows.map((row) => row.userId))];
  }
}
