import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";

/*
 * Contracts for the audit-log read and export surface (§9, D-036 slice 6c). The audit log is
 * append-only; these are read-only views and filters, plus the export snapshot. One schema, three
 * consumers (api.md).
 */

/** The audited actions (schema.prisma AuditAction) and actor kinds (ActorType). */
export const auditAction = z.enum([
  "create",
  "update",
  "delete",
  "approve",
  "share",
  "export",
  "restricted_read",
]);
export type AuditActionName = z.infer<typeof auditAction>;

export const auditActorType = z.enum(["user", "guest_token", "system"]);
export type AuditActorType = z.infer<typeof auditActorType>;

/** The filters shared by the list and the export (each optional; an absent one does not restrict). */
export const auditFilters = z.object({
  entityType: z.string().min(1).max(255).optional(),
  entityId: uuid.optional(),
  actorUserId: uuid.optional(),
  action: auditAction.optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});
export type AuditFilters = z.infer<typeof auditFilters>;

/**
 * The list query: the filters plus cursor pagination (newest first). The cursor is a prior event's
 * id, so it is validated as a uuid at the edge — a malformed cursor is a 400, never a database cast
 * error (it is compared against the uuid `id` column).
 */
export const auditEventQuery = auditFilters.merge(cursorQuery).extend({ cursor: uuid.optional() });
export type AuditEventQuery = z.infer<typeof auditEventQuery>;

/** The export query: the filters only (the export returns the whole filtered set, capped). */
export const auditExportQuery = auditFilters;
export type AuditExportQuery = z.infer<typeof auditExportQuery>;

/** One audit event. `before`/`after` are the recorded images (already masked at write time) or null. */
export const auditEventView = z.object({
  id: uuid,
  actorUserId: uuid.nullable(),
  actorType: auditActorType,
  action: auditAction,
  entityType: z.string(),
  entityId: uuid,
  projectId: uuid.nullable(),
  before: z.unknown(),
  after: z.unknown(),
  ipAddress: z.string().nullable(),
  requestId: z.string().nullable(),
  occurredAt: isoDateTime,
});
export type AuditEventView = z.infer<typeof auditEventView>;

/** A page of audit events, newest first, with the keyset cursor to continue. */
export const auditEventPage = page(auditEventView);
export type AuditEventPage = z.infer<typeof auditEventPage>;

/** The export snapshot: the filtered events plus the filters and row count the export is audited with. */
export const auditExport = z.object({
  generatedAt: isoDateTime,
  rowCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  filters: auditFilters,
  rows: z.array(auditEventView),
});
export type AuditExport = z.infer<typeof auditExport>;
