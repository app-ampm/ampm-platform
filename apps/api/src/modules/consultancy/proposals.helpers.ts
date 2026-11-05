import { errors, type HotelProposalLineInput, type HotelProposalUpdateRequest } from "@ampm/core";
import { canTransition } from "@ampm/policy";

import type { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { DomainEvent, EventBus } from "../../jobs/event-bus.js";
import { type Principal, toPolicyPrincipal } from "../../policy/principal.types.js";
import type { EnquiryRow } from "./enquiries.repository.js";
import type { EnquiriesService } from "./enquiries.service.js";
import { isEnquiryTransitionDefined } from "./enquiry-status.js";
import { moneyToDecimalString } from "./proposals.money.js";
import type { ProposalEvent } from "./proposals.events.js";
import type {
  ProposalLineRow,
  ProposalLineWrite,
  ProposalRow,
  ProposalTermsPatch,
} from "./proposals.repository.js";

/** Request line inputs → write rows (money → numeric(14,2) strings; quantity is a plain count). */
export function buildLineWrites(lines: readonly HotelProposalLineInput[]): ProposalLineWrite[] {
  return lines.map((line) => ({
    itemType: line.itemType,
    description: line.description,
    quantity: line.quantity,
    unitAmount: moneyToDecimalString(line.unitAmount),
    totalAmount: moneyToDecimalString(line.totalAmount),
    clientVisible: line.clientVisible,
  }));
}

/** Copy an existing version's lines into a revision's new line set (exact Decimal strings). */
export function copyLineWrites(lines: readonly ProposalLineRow[]): ProposalLineWrite[] {
  return lines.map((line) => ({
    itemType: line.itemType,
    description: line.description,
    quantity: line.quantity.toNumber(),
    unitAmount: line.unitAmount.toString(),
    totalAmount: line.totalAmount.toString(),
    clientVisible: line.clientVisible,
  }));
}

/** The defined terms of a draft edit (money → numeric(14,2) strings); an omitted field is untouched. */
export function buildTermsPatch(request: HotelProposalUpdateRequest): ProposalTermsPatch {
  const patch: {
    validUntil?: Date | null;
    clientTotalAmount?: string;
    internalTotalAmount?: string;
  } = {};
  if (request.validUntil !== undefined) {
    patch.validUntil = request.validUntil ? new Date(request.validUntil) : null;
  }
  if (request.clientTotal) patch.clientTotalAmount = moneyToDecimalString(request.clientTotal);
  if (request.internalTotal)
    patch.internalTotalAmount = moneyToDecimalString(request.internalTotal);
  return patch;
}

/** The staff scope over proposals, from the guard's decision: an `assigned` principal (PM) reaches only
 *  proposals whose enquiry is in their projects (via the enquiry relation, since proposals carry no
 *  project_id); SA/SM/HT/FA read all. FA/SM lack `read_internal_amount`, gated separately in the view. */
export function proposalScope(
  principal: Principal,
  access: Access,
): Prisma.HotelProposalWhereInput {
  if (access.scope === "assigned" && principal.type === "staff") {
    const projectIds = principal.memberships.map((membership) => membership.projectId);
    return { deletedAt: null, enquiry: { projectId: { in: projectIds } } };
  }
  return { deletedAt: null };
}

/** A shared proposal is expired once its `valid_until` calendar day has passed (accept/decline then 409). */
export function isProposalExpired(validUntil: Date | null, now: Date): boolean {
  if (!validUntil) return false;
  return validUntil.getTime() < new Date(now.toISOString().slice(0, 10)).getTime();
}

/** Throws a conflict when a compare-and-swap write changed no rows (the proposal moved underneath us). */
export function assertProposalChanged(changed: number): void {
  if (changed === 0) {
    throw errors.conflict(
      "The proposal changed while you were working on it; reload and try again",
    );
  }
}

/** Map the (enquiry_id, version_number) unique-index race on a concurrent create/revise to a clean 409,
 *  rather than letting Prisma's P2002 surface as a 500. */
export async function runVersioned<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw errors.conflict(
        "Another proposal version was created at the same time; reload and try again",
      );
    }
    throw error;
  }
}

/** Emit a proposal domain event best-effort after the transaction commits; a failure is logged, never
 *  fatal (no handler in 10.4 — the seam is for Module E/G/reporting). */
export async function emitProposalEvent(
  bus: EventBus,
  logger: AppLogger,
  event: DomainEvent<ProposalEvent>,
  row: ProposalRow,
  accountId: string,
): Promise<void> {
  const payload: ProposalEvent = {
    proposalId: row.id,
    enquiryId: row.enquiryId,
    accountId,
    hotelId: row.hotelId,
    versionNumber: row.versionNumber,
  };
  await bus
    .emit(event, payload)
    .catch(() =>
      logger.warn("consultancy.proposal.event_failed", { proposalId: row.id, event: event.name }),
    );
}

/** Best-effort: sharing a proposal advances its enquiry `proposal_received → client_decision`. Pre-checked
 *  so it never 409s/403s the share; a no-op unless the enquiry is at proposal_received and this actor is a
 *  mover (SA may share but is not a `→client_decision` mover, so an SA share leaves the enquiry as is). */
export async function advanceEnquiryOnShare(
  enquiries: EnquiriesService,
  logger: AppLogger,
  principal: Principal,
  access: Access,
  enquiry: EnquiryRow,
): Promise<void> {
  const to = "client_decision" as const;
  if (enquiry.status === to || !isEnquiryTransitionDefined(enquiry.status, to)) return;
  const context = {
    projectId: enquiry.projectId ?? undefined,
    accountId: enquiry.accountId,
    assigneeId: enquiry.assignedUserId ?? undefined,
    requesterId: enquiry.requestedByUserId,
  };
  if (!canTransition(toPolicyPrincipal(principal), "hotel_enquiry", enquiry.status, to, context))
    return;
  await enquiries
    .transition(principal, access, enquiry.id, { status: to, outcome: null, summary: null })
    .catch(() =>
      logger.warn("consultancy.proposal.enquiry_advance_failed", { enquiryId: enquiry.id }),
    );
}
