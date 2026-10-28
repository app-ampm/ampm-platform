import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AuditInterceptor } from "./audit.interceptor.js";
import { AuditService } from "./audit.service.js";

/**
 * The append-only audit writer (security.md §9, step 8), available to every module's mutating
 * services so the audit-on-mutation pattern needs no per-module wiring. Global like the logger. Also
 * registers the backstop AuditInterceptor, so a @Audited mutation is recorded even without an
 * explicit in-transaction call.
 */
@Global()
@Module({
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
