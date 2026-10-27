import { Injectable } from "@nestjs/common";
import { redact } from "@ampm/core";

import { requestContext } from "../common/request-context.js";
import { PrismaService } from "../db/prisma.service.js";

export type AuditAction =
  "create" | "update" | "delete" | "approve" | "share" | "export" | "restricted_read";

export interface AuditInput {
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly projectId?: string | undefined;
  readonly before?: unknown;
  readonly after?: unknown;
}

/**
 * Step 8: an append-only record of the actions the matrix says must be audited (§9), with actor,
 * request id, address and masked before/after images. Never written to the application log.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    const context = requestContext.get();
    const principal = context?.principal ?? null;
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: principal && principal.type !== "system" ? principal.userId : null,
        actorType: principal?.type === "system" ? "system" : "user",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId ?? null,
        beforeJson: input.before === undefined ? undefined : toJson(input.before),
        afterJson: input.after === undefined ? undefined : toJson(input.after),
        ipAddress: context?.ip ?? null,
        requestId: context?.requestId ?? null,
      },
    });
  }
}

function toJson(value: unknown): object {
  return JSON.parse(JSON.stringify(redact(value))) as object;
}
