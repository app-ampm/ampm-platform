import { Controller, Delete, Get, Patch, Post } from "@nestjs/common";
import {
  clientLoginCreateRequest,
  clientLoginUpdateRequest,
  uuid,
  type ClientLoginCreateRequest,
  type ClientLoginList,
  type ClientLoginUpdateRequest,
  type ClientLoginView,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { ClientLoginsService } from "./client-logins.service.js";

const projectParam = z.object({ projectId: uuid });
const projectUserParam = z.object({ projectId: uuid, userId: uuid });

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Client-login administration (Module A, feature 5.3). Scoped to one wedding by the projectParam:
 * admin.client_logins.* is held with scope `all` by SA/SM and `assigned` by PM, so the guard admits
 * SA/SM on any wedding and PM only on their own; delete is the Super Admin's. Each mutation self-audits.
 */
@Controller("admin")
export class ClientLoginsController {
  constructor(private readonly logins: ClientLoginsService) {}

  @Get("projects/:projectId/client-logins")
  @RequirePermission("admin.client_logins.read", { projectParam: "projectId" })
  list(@ZodParams(projectParam) params: { projectId: string }): Promise<ClientLoginList> {
    return this.logins.list(params.projectId);
  }

  @Get("projects/:projectId/client-logins/:userId")
  @RequirePermission("admin.client_logins.read", { projectParam: "projectId" })
  get(
    @ZodParams(projectUserParam) params: z.infer<typeof projectUserParam>,
  ): Promise<ClientLoginView> {
    return this.logins.get(params.projectId, params.userId);
  }

  @Post("projects/:projectId/client-logins")
  @RequirePermission("admin.client_logins.create", { projectParam: "projectId" })
  @SelfAudited()
  create(
    @ZodParams(projectParam) params: { projectId: string },
    @ZodBody(clientLoginCreateRequest) body: ClientLoginCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ClientLoginView> {
    return this.logins.create(params.projectId, body, staffId(principal));
  }

  @Patch("projects/:projectId/client-logins/:userId")
  @RequirePermission("admin.client_logins.update", { projectParam: "projectId" })
  @SelfAudited()
  update(
    @ZodParams(projectUserParam) params: z.infer<typeof projectUserParam>,
    @ZodBody(clientLoginUpdateRequest) body: ClientLoginUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ClientLoginView> {
    return this.logins.update(params.projectId, params.userId, body, staffId(principal));
  }

  @Delete("projects/:projectId/client-logins/:userId")
  @RequirePermission("admin.client_logins.delete", { projectParam: "projectId" })
  @SelfAudited()
  async remove(
    @ZodParams(projectUserParam) params: z.infer<typeof projectUserParam>,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    await this.logins.remove(params.projectId, params.userId, staffId(principal));
  }
}
