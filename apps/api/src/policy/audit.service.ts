import { Injectable } from "@nestjs/common";
import { redact } from "@ampm/core";

import {
  hotelFormActorRef,
  requestContext,
  type HotelFormActor,
  type RequestContext,
} from "../common/request-context.js";
import { PrismaService } from "../db/prisma.service.js";
import { Prisma, type AuditAction, type ActorType } from "../generated/prisma/client.js";
import type { Principal } from "./principal.types.js";
import { hotelFormAuditImage } from "./hotel-form-audit-image.js";

// The audit actions are the AuditAction enum of schema.prisma (via the generated client), so the TS
// type cannot drift from the database (§9). Re-exported for the services and interceptor that build
// an AuditInput.
export type { AuditAction };

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

/** Who an audit event names as its actor. */
interface AuditActor {
  readonly actorUserId: string | null;
  readonly actorType: ActorType;
  /** Set for a hotel-form contributor only (D-189 §6); left out, so null, for staff and the System. */
  readonly actorRef?: string;
}

/** A user, or the System; a write with no principal at all is stored as `user` with no id. */
function principalActor(principal: Principal | null): AuditActor {
  return {
    actorUserId: principal && principal.type !== "system" ? principal.userId : null,
    actorType: principal?.type === "system" ? "system" : "user",
  };
}

/** A hotel-form contributor (D-180): `guest_token`, no user, and their request and person or challenge. */
function hotelFormAuditActor(actor: HotelFormActor): AuditActor {
  return { actorUserId: null, actorType: "guest_token", actorRef: hotelFormActorRef(actor) };
}

/**
 * The hotel-form contributor acting in this context, or null when a principal or no one does. Both at once
 * is a fault, never a choice: an event names one actor, so neither silently replaces the other.
 */
function contributorOf(context: RequestContext | undefined): HotelFormActor | null {
  const contributor = context?.hotelFormActor ?? null;
  if (contributor !== null && (context?.principal ?? null) !== null) {
    throw new Error(
      "An audit event has one actor: a principal or a hotel-form contributor, never both",
    );
  }
  return contributor;
}

/**
 * Step 8: an append-only record of the actions the matrix says must be audited (§9), with actor,
 * request id, address and masked before/after images. Never written to the application log. When a
 * hotel-form contributor acts (the request context's hotel-form actor, D-189 §6), the event is theirs:
 * `guest_token`, with its `actor_ref`, and its images are allow-listed (hotelFormAuditImage), whatever
 * `maskImages` says. A context holding both a principal and a hotel-form actor records nothing and throws.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** `client` lets a caller record inside its own transaction, so a mutation and its audit commit together. */
  async record(input: AuditInput, client: Prisma.TransactionClient = this.prisma): Promise<void> {
    const context = requestContext.get();
    const contributor = contributorOf(context);
    const actor = contributor
      ? hotelFormAuditActor(contributor)
      : principalActor(context?.principal ?? null);
    const image = (value: unknown) =>
      contributor
        ? jsonImage(hotelFormAuditImage(value), false)
        : jsonImage(value, input.maskImages ?? true);
    await client.auditEvent.create({
      data: {
        ...actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId ?? null,
        beforeJson: image(input.before),
        afterJson: image(input.after),
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
