import { Module } from "@nestjs/common";

import { PolicyModule } from "../../../policy/policy.module.js";
import { RolesController } from "./roles.controller.js";
import { PrismaRolesRepository, RolesRepository } from "./roles.repository.js";
import { RolesService } from "./roles.service.js";

/**
 * The Super-Admin role administration surface (D-036): custom roles, their capability grants, and
 * role assignment. PolicyModule provides SessionService for revocation; PrismaService, AuditService
 * and ConfigService are global.
 */
@Module({
  imports: [PolicyModule],
  controllers: [RolesController],
  providers: [{ provide: RolesRepository, useClass: PrismaRolesRepository }, RolesService],
})
export class RolesModule {}
