import { Controller, Get } from "@nestjs/common";
import {
  auditEventQuery,
  auditExportQuery,
  type AuditEventPage,
  type AuditEventQuery,
  type AuditExport,
  type AuditExportQuery,
} from "@ampm/core";

import type { Access } from "../../../common/request-context.js";
import { ZodQuery } from "../../../common/zod.js";
import { CurrentAccess, CurrentPrincipal, RequirePermission } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { AuditLogService } from "./audit-log.service.js";

/**
 * Reading and exporting the audit log (§9, D-036 slice 6c). Gated on admin.audit_log.read / .export,
 * whose only unconditioned all-scope grant is the Super Admin's; the guard denies the assigned (PM)
 * and finance-conditioned (FA) grants on this cross-project surface, so in practice it is SA-only. The
 * service still scopes by the resolved scope as defence-in-depth. The export audits itself.
 */
@Controller("admin")
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get("audit-events")
  @RequirePermission("admin.audit_log.read")
  list(
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
    @ZodQuery(auditEventQuery) query: AuditEventQuery,
  ): Promise<AuditEventPage> {
    return this.auditLog.list(principal, access.scope, query);
  }

  @Get("audit-events/export")
  @RequirePermission("admin.audit_log.export")
  export(
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
    @ZodQuery(auditExportQuery) query: AuditExportQuery,
  ): Promise<AuditExport> {
    return this.auditLog.export(principal, access.scope, query);
  }
}
