import { Injectable } from "@nestjs/common";
import type { AuditActorType, AuditActionName, AuditFilters } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/** One audit event as read from the append-only log. */
export interface AuditEventRow {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly actorType: AuditActorType;
  readonly action: AuditActionName;
  readonly entityType: string;
  readonly entityId: string;
  readonly projectId: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly ipAddress: string | null;
  readonly requestId: string | null;
  readonly occurredAt: Date;
}

/**
 * How far a read reaches: every project ("all", the Super Admin), or only the named projects (the
 * assigned scope). An empty project list reaches nothing — fail-closed.
 */
export type AuditProjectScope =
  { readonly kind: "all" } | { readonly kind: "projects"; readonly projectIds: readonly string[] };

export abstract class AuditLogRepository {
  abstract list(
    scope: AuditProjectScope,
    filters: AuditFilters,
    limit: number,
    cursor: string | undefined,
  ): Promise<{ rows: AuditEventRow[]; nextCursor: string | null }>;
  abstract export(
    scope: AuditProjectScope,
    filters: AuditFilters,
    max: number,
  ): Promise<{ rows: AuditEventRow[]; truncated: boolean }>;
}

type AuditEventRecord = {
  id: string;
  actorUserId: string | null;
  actorType: AuditActorType;
  action: AuditActionName;
  entityType: string;
  entityId: string;
  projectId: string | null;
  beforeJson: Prisma.JsonValue | null;
  afterJson: Prisma.JsonValue | null;
  ipAddress: string | null;
  requestId: string | null;
  occurredAt: Date;
};

function toRow(event: AuditEventRecord): AuditEventRow {
  return {
    id: event.id,
    actorUserId: event.actorUserId,
    actorType: event.actorType,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    projectId: event.projectId,
    before: event.beforeJson,
    after: event.afterJson,
    ipAddress: event.ipAddress,
    requestId: event.requestId,
    occurredAt: event.occurredAt,
  };
}

/** The read `where` from the scope and filters; an absent filter does not restrict. */
function buildWhere(scope: AuditProjectScope, filters: AuditFilters): Prisma.AuditEventWhereInput {
  const where: Prisma.AuditEventWhereInput = {};
  if (scope.kind === "projects") where.projectId = { in: [...scope.projectIds] };
  if (filters.entityType !== undefined) where.entityType = filters.entityType;
  if (filters.entityId !== undefined) where.entityId = filters.entityId;
  if (filters.actorUserId !== undefined) where.actorUserId = filters.actorUserId;
  if (filters.action !== undefined) where.action = filters.action;
  if (filters.from !== undefined || filters.to !== undefined) {
    where.occurredAt = {
      ...(filters.from !== undefined ? { gte: new Date(filters.from) } : {}),
      ...(filters.to !== undefined ? { lte: new Date(filters.to) } : {}),
    };
  }
  return where;
}

@Injectable()
export class PrismaAuditLogRepository extends AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(
    scope: AuditProjectScope,
    filters: AuditFilters,
    limit: number,
    cursor: string | undefined,
  ): Promise<{ rows: AuditEventRow[]; nextCursor: string | null }> {
    // Keyset on the uuid-v7 id (time-ordered, newest first); the table is partitioned, so an id range
    // stands in for Prisma's cursor, as in the notification repository.
    const where = buildWhere(scope, filters);
    if (cursor) where.id = { lt: cursor };
    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    return {
      rows: pageRows.map(toRow),
      nextCursor: hasMore && last ? last.id : null,
    };
  }

  async export(
    scope: AuditProjectScope,
    filters: AuditFilters,
    max: number,
  ): Promise<{ rows: AuditEventRow[]; truncated: boolean }> {
    const rows = await this.prisma.auditEvent.findMany({
      where: buildWhere(scope, filters),
      orderBy: { id: "desc" },
      take: max + 1,
    });
    const truncated = rows.length > max;
    return { rows: (truncated ? rows.slice(0, max) : rows).map(toRow), truncated };
  }
}
