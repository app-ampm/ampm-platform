import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  errors,
  type CapabilityView,
  type RoleCreateRequest,
  type RoleUpdateRequest,
  type RoleView,
} from "@ampm/core";
import { assignableCapabilities, capabilityById, type GrantableCapability } from "@ampm/policy";

import { PrismaService } from "../../../db/prisma.service.js";
import { AuditService } from "../../../policy/audit.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import { SessionService } from "../../../policy/session.service.js";
import { RolesRepository, type RoleRow } from "./roles.repository.js";

/**
 * A system role may carry escalation-locked power that a custom role never can, so handing one out is
 * itself a Super-Admin-grade act. Gating on the Super Admin role (not on a capability a lesser role
 * could hold) keeps this safe even if admin.staff_users.update is ever delegated to a lower staff admin.
 */
function isSuperAdmin(principal: Principal): boolean {
  return principal.type === "staff" && principal.roles.includes("SA");
}

function toCapabilityView(capability: GrantableCapability): CapabilityView {
  return {
    id: capability.id,
    module: capability.module,
    resource: capability.resource,
    action: capability.action,
    scope: capability.scope,
    label: capability.label,
    isEscalationLocked: capability.isEscalationLocked,
    sourceRoles: [...capability.sourceRoles],
  };
}

/**
 * The Super-Admin role administration surface (D-036). Every mutation runs in one transaction with its
 * before/after audit, and revokes the affected users' sessions. Guardrails: SA-only (the controller's
 * @RequirePermission), a custom role may hold only *assignable* catalog capabilities (never an
 * escalation-locked one, e.g. role or account administration), and the nine system roles are immutable.
 * With per-request grant resolution (phase 5) a change is already seen on the next request; the session
 * revocation is defence-in-depth and ends any live session at once.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  /** The capabilities a custom role may be granted — the Super-Admin pick-list. */
  capabilities(): CapabilityView[] {
    return assignableCapabilities().map(toCapabilityView);
  }

  async list(): Promise<RoleView[]> {
    const roles = await this.repository.listCustom();
    return roles.map((role) => this.toView(role));
  }

  async get(id: string): Promise<RoleView> {
    return this.toView(await this.require(id));
  }

  async create(request: RoleCreateRequest, actorId: string): Promise<RoleView> {
    this.assertAssignable(request.capabilityIds);
    const roleKey = `custom_${randomUUID()}`;
    const { id } = await this.prisma.$transaction(async (tx) => {
      const created = await this.repository.create(
        { name: request.name, roleKey, createdBy: actorId },
        tx,
      );
      await this.repository.setGrants(created.id, request.capabilityIds, actorId, tx);
      await this.audit.record(
        {
          action: "create",
          entityType: "role",
          entityId: created.id,
          after: { name: request.name, capabilityIds: request.capabilityIds },
          maskImages: false,
        },
        tx,
      );
      return created;
    });
    return this.get(id);
  }

  async update(id: string, request: RoleUpdateRequest, actorId: string): Promise<RoleView> {
    const before = await this.requireCustom(id);
    if (request.capabilityIds !== undefined) this.assertAssignable(request.capabilityIds);
    await this.prisma.$transaction(async (tx) => {
      if (request.name !== undefined) await this.repository.rename(id, request.name, actorId, tx);
      if (request.capabilityIds !== undefined) {
        await this.repository.setGrants(id, request.capabilityIds, actorId, tx);
      }
      await this.audit.record(
        {
          action: "update",
          entityType: "role",
          entityId: id,
          before: { name: before.name, capabilityIds: before.capabilityKeys },
          after: {
            name: request.name ?? before.name,
            capabilityIds: request.capabilityIds ?? before.capabilityKeys,
          },
          maskImages: false,
        },
        tx,
      );
    });
    await this.revokeHolders(id, "role_changed");
    return this.get(id);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const before = await this.requireCustom(id);
    const holders = await this.repository.userIdsWithRole(id);
    await this.prisma.$transaction(async (tx) => {
      await this.repository.softDelete(id, actorId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "role",
          entityId: id,
          before: { name: before.name, capabilityIds: before.capabilityKeys },
          maskImages: false,
        },
        tx,
      );
    });
    await this.revoke(holders, "role_deleted");
  }

  async assign(userId: string, roleId: string, actor: Principal): Promise<void> {
    if (!(await this.repository.userExists(userId))) throw errors.notFound("No such user");
    const role = await this.require(roleId);
    if (role.isSystem && !isSuperAdmin(actor)) {
      throw errors.forbidden("Only a Super Admin may assign a system role");
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repository.assign(userId, roleId, tx);
      await this.audit.record(
        {
          action: "create",
          entityType: "user_role",
          entityId: userId,
          after: { roleId },
          maskImages: false,
        },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(userId, "role_changed");
  }

  async unassign(userId: string, roleId: string): Promise<void> {
    const removed = await this.prisma.$transaction(async (tx) => {
      const count = await this.repository.unassign(userId, roleId, tx);
      if (count === 0) return 0;
      await this.audit.record(
        {
          action: "delete",
          entityType: "user_role",
          entityId: userId,
          before: { roleId },
          maskImages: false,
        },
        tx,
      );
      return count;
    });
    if (removed === 0) throw errors.notFound("That role is not assigned to the user");
    await this.sessions.revokeAllForUser(userId, "role_changed");
  }

  /** Rejects any capability that is not in the catalog or is not assignable (escalation-locked). */
  private assertAssignable(capabilityIds: readonly string[]): void {
    const allowed = new Set(assignableCapabilities().map((capability) => capability.id));
    for (const id of capabilityIds) {
      if (!capabilityById(id)) {
        throw errors.validation([{ path: "capabilityIds", message: `unknown capability "${id}"` }]);
      }
      if (!allowed.has(id)) {
        throw errors.forbidden(`capability "${id}" cannot be granted to a custom role`);
      }
    }
  }

  private async require(id: string): Promise<RoleRow> {
    const role = await this.repository.findById(id);
    if (!role) throw errors.notFound("No such role");
    return role;
  }

  private async requireCustom(id: string): Promise<RoleRow> {
    const role = await this.require(id);
    if (role.isSystem) throw errors.conflict("A system role cannot be edited or deleted");
    return role;
  }

  private async revokeHolders(roleId: string, reason: string): Promise<void> {
    await this.revoke(await this.repository.userIdsWithRole(roleId), reason);
  }

  private async revoke(userIds: readonly string[], reason: string): Promise<void> {
    for (const userId of userIds) await this.sessions.revokeAllForUser(userId, reason);
  }

  private toView(role: RoleRow): RoleView {
    const capabilities = role.capabilityKeys
      .map((key) => capabilityById(key))
      .filter((capability): capability is GrantableCapability => capability !== undefined)
      .map(toCapabilityView);
    return {
      id: role.id,
      roleKey: role.roleKey,
      name: role.name,
      isSystem: role.isSystem,
      capabilities,
    };
  }
}
