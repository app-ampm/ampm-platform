import { Controller, Delete, Get, Patch, Post } from "@nestjs/common";
import {
  staffUserCreateRequest,
  staffUserQuery,
  staffUserStatusRequest,
  staffUserUpdateRequest,
  uuid,
  type StaffUserCreateRequest,
  type StaffUserPage,
  type StaffUserQuery,
  type StaffUserStatusRequest,
  type StaffUserUpdateRequest,
  type StaffUserView,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { StaffUsersService } from "./staff-users.service.js";

const idParam = z.object({ id: uuid });

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Staff-user administration (Module A, feature 5.1). Reads are open to every staff role
 * (`admin.staff_users.read`); create/update/delete are the Super Admin's. Role assignment is the
 * separate /admin/users surface (slice 6a). Each mutation self-audits in its service transaction.
 */
@Controller("admin")
export class StaffUsersController {
  constructor(private readonly users: StaffUsersService) {}

  @Get("staff-users")
  @RequirePermission("admin.staff_users.read")
  list(@ZodQuery(staffUserQuery) query: StaffUserQuery): Promise<StaffUserPage> {
    return this.users.list(query);
  }

  @Get("staff-users/:id")
  @RequirePermission("admin.staff_users.read")
  get(@ZodParams(idParam) params: { id: string }): Promise<StaffUserView> {
    return this.users.get(params.id);
  }

  @Post("staff-users")
  @RequirePermission("admin.staff_users.create")
  @SelfAudited()
  create(
    @ZodBody(staffUserCreateRequest) body: StaffUserCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<StaffUserView> {
    return this.users.create(body, staffId(principal));
  }

  @Patch("staff-users/:id")
  @RequirePermission("admin.staff_users.update")
  @SelfAudited()
  update(
    @ZodParams(idParam) params: { id: string },
    @ZodBody(staffUserUpdateRequest) body: StaffUserUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<StaffUserView> {
    return this.users.update(params.id, body, staffId(principal));
  }

  @Patch("staff-users/:id/status")
  @RequirePermission("admin.staff_users.update")
  @SelfAudited()
  setStatus(
    @ZodParams(idParam) params: { id: string },
    @ZodBody(staffUserStatusRequest) body: StaffUserStatusRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<StaffUserView> {
    return this.users.setStatus(params.id, body, staffId(principal));
  }

  @Delete("staff-users/:id")
  @RequirePermission("admin.staff_users.delete")
  @SelfAudited()
  async remove(
    @ZodParams(idParam) params: { id: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    await this.users.remove(params.id, staffId(principal));
  }
}
