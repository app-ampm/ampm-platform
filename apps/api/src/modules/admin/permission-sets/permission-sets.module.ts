import { Module } from "@nestjs/common";

import { PolicyModule } from "../../../policy/policy.module.js";
import { PermissionSetsController } from "./permission-sets.controller.js";
import {
  PermissionSetsRepository,
  PrismaPermissionSetsRepository,
} from "./permission-sets.repository.js";
import { PermissionSetsService } from "./permission-sets.service.js";

/**
 * The Super-Admin permission-set surface (D-036, slice 6b): reusable capability bundles and
 * attach-to-role. PolicyModule provides SessionService for revocation; PrismaService and AuditService
 * are global.
 */
@Module({
  imports: [PolicyModule],
  controllers: [PermissionSetsController],
  providers: [
    { provide: PermissionSetsRepository, useClass: PrismaPermissionSetsRepository },
    PermissionSetsService,
  ],
})
export class PermissionSetsModule {}
