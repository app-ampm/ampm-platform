import { Module } from "@nestjs/common";

import { AuditLogController } from "./audit-log.controller.js";
import { AuditLogRepository, PrismaAuditLogRepository } from "./audit-log.repository.js";
import { AuditLogService } from "./audit-log.service.js";

/**
 * The audit-log read/export surface (D-036, slice 6c). PrismaService and the writer AuditService are
 * global, so no imports are needed.
 */
@Module({
  controllers: [AuditLogController],
  providers: [{ provide: AuditLogRepository, useClass: PrismaAuditLogRepository }, AuditLogService],
})
export class AuditLogModule {}
