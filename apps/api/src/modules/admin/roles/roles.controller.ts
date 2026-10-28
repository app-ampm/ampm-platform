import { Controller, Delete, Get, Patch, Post } from "@nestjs/common";
import {
  assignRoleRequest,
  roleCreateRequest,
  roleUpdateRequest,
  uuid,
  type AssignRoleRequest,
  type CapabilityView,
  type RoleCreateRequest,
  type RoleUpdateRequest,
  type RoleView,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { RolesService } from "./roles.service.js";

const idParam = z.object({ id: uuid });
const userParam = z.object({ userId: uuid });
const userRoleParam = z.object({ userId: uuid, roleId: uuid });

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Super-Admin role administration (D-036, permission-matrix §5.1). All of it is SA-only
 * (@RequirePermission); each mutation self-audits in its service transaction and revokes the affected
 * users' sessions.
 */
@Controller("admin")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** The capabilities a custom role may be granted (the editor's pick-list). */
  @Get("capabilities")
  @RequirePermission("admin.roles.read")
  capabilities(): CapabilityView[] {
    return this.roles.capabilities();
  }

  @Get("roles")
  @RequirePermission("admin.roles.read")
  list(): Promise<RoleView[]> {
    return this.roles.list();
  }

  @Get("roles/:id")
  @RequirePermission("admin.roles.read")
  get(@ZodParams(idParam) params: { id: string }): Promise<RoleView> {
    return this.roles.get(params.id);
  }

  @Post("roles")
  @RequirePermission("admin.roles.create")
  @SelfAudited()
  create(
    @ZodBody(roleCreateRequest) body: RoleCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RoleView> {
    return this.roles.create(body, staffId(principal));
  }

  @Patch("roles/:id")
  @RequirePermission("admin.roles.update")
  @SelfAudited()
  update(
    @ZodParams(idParam) params: { id: string },
    @ZodBody(roleUpdateRequest) body: RoleUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RoleView> {
    return this.roles.update(params.id, body, staffId(principal));
  }

  @Delete("roles/:id")
  @RequirePermission("admin.roles.delete")
  @SelfAudited()
  async remove(
    @ZodParams(idParam) params: { id: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    await this.roles.remove(params.id, staffId(principal));
  }

  @Post("users/:userId/roles")
  @RequirePermission("admin.staff_users.update")
  @SelfAudited()
  async assign(
    @ZodParams(userParam) params: { userId: string },
    @ZodBody(assignRoleRequest) body: AssignRoleRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    await this.roles.assign(params.userId, body.roleId, principal);
  }

  @Delete("users/:userId/roles/:roleId")
  @RequirePermission("admin.staff_users.update")
  @SelfAudited()
  async unassign(@ZodParams(userRoleParam) params: z.infer<typeof userRoleParam>): Promise<void> {
    await this.roles.unassign(params.userId, params.roleId);
  }
}
