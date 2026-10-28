import { Global, Module } from "@nestjs/common";

import { AuditService } from "./audit.service.js";

/**
 * The append-only audit writer (security.md §9, step 8), available to every module's mutating
 * services so the audit-on-mutation pattern needs no per-module wiring. Global like the logger.
 */
@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
