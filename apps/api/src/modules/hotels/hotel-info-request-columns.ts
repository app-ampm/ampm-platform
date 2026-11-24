import type { HotelInfoRequestCreateRequest } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import type { RequestActor, RequestAudit } from "./hotel-info-request-journal.js";

/*
 * What creating a hotel information request writes (D-188 §1 and §3): its columns and its `share` audit.
 * Neither holds the link: the columns hold only its hash, and the audit neither, nor the recipient.
 */

/** What a create resolved its target to: the columns that name it, and the hotel's name. */
export interface ResolvedTarget {
  readonly columns: Omit<
    Prisma.HotelInfoRequestUncheckedCreateInput,
    "reference" | "kind" | "target" | "expiresAt" | "tokenHash" | "linkIssuedAt"
  >;
  readonly name: string;
}

/** A new link: its hash, its time, its expiry and who issued it. */
export interface Issue {
  readonly actor: RequestActor;
  readonly hash: string;
  readonly at: Date;
  readonly expiresAt: Date;
}

/** The fields staff entered, null when not given. */
function staffColumnsOf(body: HotelInfoRequestCreateRequest) {
  return {
    displayLabel: body.displayLabel ?? null,
    staffNote: body.staffNote ?? null,
    officialWebsite: body.officialWebsite ?? null,
    switchboardPhone: body.switchboardPhone ?? null,
    switchboardSource: body.switchboardSource ?? null,
    recipientName: body.recipientName ?? null,
    recipientEmail: body.recipientEmail ?? null,
  };
}

/**
 * Every column a create writes: the target's, the staff fields, the link's hash, its expiry and status.
 *
 * @example
 * repo.create(createColumns(body, target, issue, "HIR-2026-0007", staffId(principal)), tx);
 */
export function createColumns(
  body: HotelInfoRequestCreateRequest,
  target: ResolvedTarget,
  issue: Issue,
  reference: string,
  actorId: string,
): Prisma.HotelInfoRequestUncheckedCreateInput {
  return {
    ...target.columns,
    ...staffColumnsOf(body),
    reference,
    kind: body.kind,
    target: body.target,
    isTest: body.isTest,
    status: "open",
    expiresAt: issue.expiresAt,
    tokenHash: issue.hash,
    tokenGeneration: 1,
    linkIssuedAt: issue.at,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

/**
 * A create's `share` audit: what was issued, never the link nor the recipient.
 *
 * @example
 * journal.record(id, createdAudit(body, target, issue, reference), tx);
 */
export function createdAudit(
  body: HotelInfoRequestCreateRequest,
  target: ResolvedTarget,
  issue: Issue,
  reference: string,
): RequestAudit {
  const after = {
    issued: "created",
    reference,
    target: body.target,
    kind: body.kind,
    hotelId: target.columns.hotelId ?? null,
    isTest: body.isTest,
    status: "open",
    expiresAt: issue.expiresAt.toISOString(),
    tokenGeneration: 1,
  };
  return { action: "share", after };
}
