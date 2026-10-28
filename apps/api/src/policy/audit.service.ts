import { Injectable } from "@nestjs/common";
import { redact } from "@ampm/core";

import { requestContext } from "../common/request-context.js";
import { PrismaService } from "../db/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";

export type AuditAction =
  "create" | "update" | "delete" | "approve" | "share" | "export" | "restricted_read";

export interface AuditInput {
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly projectId?: string | undefined;
  readonly before?: unknown;
  readonly after?: unknown;
  /**
   * Mask PII-named keys in the before/after images (default true). Turn it off only for records
   * whose images are schema-validated non-sensitive values — e.g. configuration, whose fields can be
   * legitimately named `email` or `token` — so the masker does not corrupt the audited value.
   */
  readonly maskImages?: boolean;
}

/**
 * Step 8: an append-only record of the actions the matrix says must be audited (§9), with actor,
 * request id, address and masked before/after images. Never written to the application log.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** `client` lets a caller record inside its own transaction, so a mutation and its audit commit together. */
  async record(input: AuditInput, client: Prisma.TransactionClient = this.prisma): Promise<void> {
    const context = requestContext.get();
    const principal = context?.principal ?? null;
    const mask = input.maskImages ?? true;
    await client.auditEvent.create({
      data: {
        actorUserId: principal && principal.type !== "system" ? principal.userId : null,
        actorType: principal?.type === "system" ? "system" : "user",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId ?? null,
        beforeJson: jsonImage(input.before, mask),
        afterJson: jsonImage(input.after, mask),
        ipAddress: context?.ip ?? null,
        requestId: context?.requestId ?? null,
      },
    });
  }
}

/** A before/after image for a Json? column: omitted when absent, JSON null when explicitly null. */
function jsonImage(
  value: unknown,
  mask: boolean,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(mask ? redact(value) : value)) as Prisma.InputJsonValue;
}
