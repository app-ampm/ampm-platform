import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  errors,
  type PermissionSetCreateRequest,
  type PermissionSetUpdateRequest,
  type PermissionSetView,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { AuditService } from "../../../policy/audit.service.js";
import { SessionService } from "../../../policy/session.service.js";
import { assertAssignable, capabilityViewsForKeys } from "../capability-grants.js";
import { PermissionSetsRepository, type PermissionSetRow } from "./permission-sets.repository.js";

/**
 * The Super-Admin permission-set surface (D-036, slice 6b): reusable bundles of catalog capabilities,
 * and attaching a set to a custom role. A role's effective grants are its direct grants unioned with
 * the grants of every attached set — resolution already does the union (phase 5), so this layer only
 * administers the data. Every mutation runs in one transaction with its before/after audit; a set may
 * hold only *assignable* capabilities (never escalation-locked), system sets are immutable, and a set
 * attaches only to a custom role (a system role resolves through the matrix, so an attach there would
 * never take effect). Changing or deleting a set revokes the sessions of everyone it reaches.
 */
@Injectable()
export class PermissionSetsService {
  constructor(
    private readonly repository: PermissionSetsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async list(): Promise<PermissionSetView[]> {
    const sets = await this.repository.listCustom();
    return sets.map((set) => this.toView(set));
  }

  async get(id: string): Promise<PermissionSetView> {
    return this.toView(await this.require(id));
  }

  async create(request: PermissionSetCreateRequest, actorId: string): Promise<PermissionSetView> {
    assertAssignable(request.capabilityIds);
    const capabilityIds = [...new Set(request.capabilityIds)];
    const setKey = `custom_${randomUUID()}`;
    const { id } = await this.prisma.$transaction(async (tx) => {
      const created = await this.repository.create(
        {
          name: request.name,
          description: request.description ?? null,
          setKey,
          createdBy: actorId,
        },
        tx,
      );
      await this.repository.setGrants(created.id, capabilityIds, actorId, tx);
      await this.audit.record(
        {
          action: "create",
          entityType: "permission_set",
          entityId: created.id,
          after: { name: request.name, description: request.description ?? null, capabilityIds },
          maskImages: false,
        },
        tx,
      );
      return created;
    });
    return this.get(id);
  }

  async update(
    id: string,
    request: PermissionSetUpdateRequest,
    actorId: string,
  ): Promise<PermissionSetView> {
    const existing = await this.requireCustom(id);
    if (request.capabilityIds !== undefined) assertAssignable(request.capabilityIds);
    const capabilityIds =
      request.capabilityIds === undefined ? undefined : [...new Set(request.capabilityIds)];
    const before = this.snapshot(existing.name, existing.description, existing.capabilityKeys);
    const after = this.snapshot(
      request.name ?? existing.name,
      request.description !== undefined ? request.description : existing.description,
      capabilityIds ?? existing.capabilityKeys,
    );
    await this.prisma.$transaction(async (tx) => {
      if (request.name !== undefined || request.description !== undefined) {
        await this.repository.updateMeta(
          id,
          { name: request.name, description: request.description },
          actorId,
          tx,
        );
      }
      if (capabilityIds !== undefined) {
        await this.repository.setGrants(id, capabilityIds, actorId, tx);
      }
      const event = { action: "update", entityType: "permission_set", entityId: id } as const;
      await this.audit.record({ ...event, before, after, maskImages: false }, tx);
    });
    await this.revokeSetHolders(id, "permission_set_changed");
    return this.get(id);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const before = await this.requireCustom(id);
    const holders = await this.repository.userIdsWithSet(id);
    await this.prisma.$transaction(async (tx) => {
      await this.repository.softDelete(id, actorId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "permission_set",
          entityId: id,
          before: {
            name: before.name,
            description: before.description,
            capabilityIds: before.capabilityKeys,
          },
          maskImages: false,
        },
        tx,
      );
    });
    await this.revoke(holders, "permission_set_deleted");
  }

  async attach(roleId: string, setId: string): Promise<void> {
    await this.require(setId);
    const role = await this.repository.findRole(roleId);
    if (!role) throw errors.notFound("No such role");
    if (role.isSystem) {
      throw errors.conflict("A permission set can only be attached to a custom role");
    }
    const attached = await this.prisma.$transaction(async (tx) => {
      const count = await this.repository.attach(roleId, setId, tx);
      if (count === 0) return 0;
      await this.audit.record(
        {
          action: "create",
          entityType: "role_permission_set",
          entityId: roleId,
          after: { setId },
          maskImages: false,
        },
        tx,
      );
      return count;
    });
    // Re-attaching an already-linked set is a no-op: no audit written, no needless session revocation.
    if (attached > 0) {
      await this.revoke(await this.repository.userIdsWithRole(roleId), "role_changed");
    }
  }

  async detach(roleId: string, setId: string): Promise<void> {
    const removed = await this.prisma.$transaction(async (tx) => {
      const count = await this.repository.detach(roleId, setId, tx);
      if (count === 0) return 0;
      await this.audit.record(
        {
          action: "delete",
          entityType: "role_permission_set",
          entityId: roleId,
          before: { setId },
          maskImages: false,
        },
        tx,
      );
      return count;
    });
    if (removed === 0) throw errors.notFound("That permission set is not attached to the role");
    await this.revoke(await this.repository.userIdsWithRole(roleId), "role_changed");
  }

  private async require(id: string): Promise<PermissionSetRow> {
    const set = await this.repository.findById(id);
    if (!set) throw errors.notFound("No such permission set");
    return set;
  }

  private async requireCustom(id: string): Promise<PermissionSetRow> {
    const set = await this.require(id);
    if (set.isSystem) throw errors.conflict("A system permission set cannot be edited or deleted");
    return set;
  }

  private async revokeSetHolders(setId: string, reason: string): Promise<void> {
    await this.revoke(await this.repository.userIdsWithSet(setId), reason);
  }

  private async revoke(userIds: readonly string[], reason: string): Promise<void> {
    for (const userId of userIds) await this.sessions.revokeAllForUser(userId, reason);
  }

  /** The before/after shape recorded in a permission-set audit event. */
  private snapshot(
    name: string,
    description: string | null,
    capabilityKeys: readonly string[],
  ): { name: string; description: string | null; capabilityIds: readonly string[] } {
    return { name, description, capabilityIds: capabilityKeys };
  }

  private toView(set: PermissionSetRow): PermissionSetView {
    return {
      id: set.id,
      setKey: set.setKey,
      name: set.name,
      description: set.description,
      isSystem: set.isSystem,
      capabilities: capabilityViewsForKeys(set.capabilityKeys),
    };
  }
}
