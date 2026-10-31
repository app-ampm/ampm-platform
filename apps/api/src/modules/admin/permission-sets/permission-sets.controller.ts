import { Controller, Delete, Get, Patch, Post } from "@nestjs/common";
import {
  attachPermissionSetRequest,
  permissionSetCreateRequest,
  permissionSetUpdateRequest,
  uuid,
  type AttachPermissionSetRequest,
  type PermissionSetCreateRequest,
  type PermissionSetUpdateRequest,
  type PermissionSetView,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { PermissionSetsService } from "./permission-sets.service.js";

const idParam = z.object({ id: uuid });
const roleParam = z.object({ roleId: uuid });
const roleSetParam = z.object({ roleId: uuid, setId: uuid });

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Super-Admin permission-set administration (D-036, slice 6b). All of it is SA-only, reusing the
 * admin.roles.* permission keys (permission sets are part of role administration; the golden matrix has
 * no separate key). Each mutation self-audits in its service transaction and revokes affected sessions.
 */
@Controller("admin")
export class PermissionSetsController {
  constructor(private readonly sets: PermissionSetsService) {}

  @Get("permission-sets")
  @RequirePermission("admin.roles.read")
  list(): Promise<PermissionSetView[]> {
    return this.sets.list();
  }

  @Get("permission-sets/:id")
  @RequirePermission("admin.roles.read")
  get(@ZodParams(idParam) params: { id: string }): Promise<PermissionSetView> {
    return this.sets.get(params.id);
  }

  @Post("permission-sets")
  @RequirePermission("admin.roles.create")
  @SelfAudited()
  create(
    @ZodBody(permissionSetCreateRequest) body: PermissionSetCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<PermissionSetView> {
    return this.sets.create(body, staffId(principal));
  }

  @Patch("permission-sets/:id")
  @RequirePermission("admin.roles.update")
  @SelfAudited()
  update(
    @ZodParams(idParam) params: { id: string },
    @ZodBody(permissionSetUpdateRequest) body: PermissionSetUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<PermissionSetView> {
    return this.sets.update(params.id, body, staffId(principal));
  }

  @Delete("permission-sets/:id")
  @RequirePermission("admin.roles.delete")
  @SelfAudited()
  async remove(
    @ZodParams(idParam) params: { id: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    await this.sets.remove(params.id, staffId(principal));
  }

  @Post("roles/:roleId/permission-sets")
  @RequirePermission("admin.roles.update")
  @SelfAudited()
  async attach(
    @ZodParams(roleParam) params: { roleId: string },
    @ZodBody(attachPermissionSetRequest) body: AttachPermissionSetRequest,
  ): Promise<void> {
    await this.sets.attach(params.roleId, body.setId);
  }

  @Delete("roles/:roleId/permission-sets/:setId")
  @RequirePermission("admin.roles.update")
  @SelfAudited()
  async detach(@ZodParams(roleSetParam) params: z.infer<typeof roleSetParam>): Promise<void> {
    await this.sets.detach(params.roleId, params.setId);
  }
}
