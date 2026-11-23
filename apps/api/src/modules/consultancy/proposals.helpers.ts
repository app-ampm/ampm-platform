import { errors, type HotelProposalLineInput, type HotelProposalUpdateRequest } from "@ampm/core";

import type { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { DomainEvent, EventBus } from "../../jobs/event-bus.js";
import type { Principal } from "../../policy/principal.types.js";
import { moneyToDecimalString } from "../../common/money.js";
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
