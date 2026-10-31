import { Injectable } from "@nestjs/common";
import type {
  AuditEventPage,
  AuditEventQuery,
  AuditEventView,
  AuditExport,
  AuditExportQuery,
} from "@ampm/core";
import type { Scope } from "@ampm/policy";

import { AuditService } from "../../../policy/audit.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import {
  AuditLogRepository,
  type AuditEventRow,
  type AuditProjectScope,
} from "./audit-log.repository.js";

/** A collection-level export has no single entity, so it is audited against the nil UUID. */
const AUDIT_LOG_ENTITY_ID = "00000000-0000-0000-0000-000000000000";
/** The most rows one export returns; a larger result is truncated, and the audit says so. */
const MAX_EXPORT_ROWS = 10_000;

function toView(row: AuditEventRow): AuditEventView {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    actorType: row.actorType,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    projectId: row.projectId,
    before: row.before,
    after: row.after,
    ipAddress: row.ipAddress,
    requestId: row.requestId,
    occurredAt: row.occurredAt.toISOString(),
  };
}

/**
 * Reading and exporting the append-only audit log (§9, D-036 slice 6c). The guard resolves the scope
 * from admin.audit_log.read / .export: the Super Admin reads and exports every project; the assigned
 * scope (defence-in-depth here) reaches only the principal's memberships. Each export records an
 * export audit event with its filters and row count. The finance-entity-conditioned and per-project
 * reader views (FA, PM) are denied by the guard today and await the subject-condition plumbing.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly repository: AuditLogRepository,
    private readonly audit: AuditService,
  ) {}

  async list(principal: Principal, scope: Scope, query: AuditEventQuery): Promise<AuditEventPage> {
    const { cursor, limit, ...filters } = query;
    const { rows, nextCursor } = await this.repository.list(
      this.projectScope(principal, scope),
      filters,
      limit,
      cursor,
    );
    return { items: rows.map(toView), nextCursor };
  }

  async export(
    principal: Principal,
    scope: Scope,
    filters: AuditExportQuery,
  ): Promise<AuditExport> {
    const { rows, truncated } = await this.repository.export(
      this.projectScope(principal, scope),
      filters,
      MAX_EXPORT_ROWS,
    );
    // Every export is audited with its filters and row count (security.md §9). The after-image is the
    // query filters — non-sensitive parameters — so it is recorded verbatim (maskImages: false), like
    // configuration, rather than run through the PII-key masker.
    await this.audit.record({
      action: "export",
      entityType: "audit_log",
      entityId: AUDIT_LOG_ENTITY_ID,
      after: { filters, rowCount: rows.length, truncated },
      maskImages: false,
    });
    return {
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      truncated,
      filters,
      rows: rows.map(toView),
    };
  }

  /**
   * The projects a read reaches, from the guard-resolved scope: "all" reaches every project; "assigned"
   * reaches the principal's memberships; anything else reaches none (fail-closed). audit_events is
   * append-only with no soft-delete/demo/owner columns, so this maps the scope directly rather than
   * through the generic recordScope.
   */
  private projectScope(principal: Principal, scope: Scope): AuditProjectScope {
    if (scope === "all") return { kind: "all" };
    if (scope === "assigned" && principal.type !== "system") {
      return { kind: "projects", projectIds: principal.memberships.map((m) => m.projectId) };
    }
    return { kind: "projects", projectIds: [] };
  }
}
