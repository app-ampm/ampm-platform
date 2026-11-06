import {
  errors,
  type BookingMilestoneCreateRequest,
  type BookingMilestoneType,
  type BookingMilestoneUpdateRequest,
} from "@ampm/core";

import type { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { DomainEvent, EventBus } from "../../jobs/event-bus.js";
import type { Principal } from "../../policy/principal.types.js";
import type { MilestoneEvent } from "./booking-milestones.events.js";
import { moneyToDecimalString } from "./booking-milestones.money.js";
import type {
  BookingMilestoneEditPatch,
  BookingMilestoneRow,
  BookingMilestoneWriteData,
} from "./booking-milestones.repository.js";
import type { EnquiryRow } from "./enquiries.repository.js";

const PAYMENT_MILESTONE_TYPES: ReadonlySet<BookingMilestoneType> = new Set<BookingMilestoneType>([
  "advance_paid",
  "balance_due",
]);

/** A payment milestone records money moving (offline bank transfer, v1); completing it emits `paid`. */
export function isPaymentMilestone(type: BookingMilestoneType): boolean {
  return PAYMENT_MILESTONE_TYPES.has(type);
}

/** Create request → write row: the single money object drives both the amount and currency columns; the
 *  project is inherited from the enquiry (never the request), to be back-filled by Module E (GP-27). */
export function buildMilestoneWrite(
  request: BookingMilestoneCreateRequest,
  enquiry: EnquiryRow,
): BookingMilestoneWriteData {
  return {
    enquiryId: enquiry.id,
    projectId: enquiry.projectId,
    milestoneType: request.milestoneType,
    dueAt: request.dueAt ? new Date(request.dueAt) : null,
    amount: request.amount ? moneyToDecimalString(request.amount) : null,
    currency: request.amount ? request.amount.currency : null,
    contractId: request.contractId,
    documentId: request.documentId,
  };
}

/** The defined fields of a milestone edit (an omitted field untouched); the money object drives both the
 *  amount and currency columns together, so clearing the amount clears the currency. */
export function buildMilestoneEditPatch(
  request: BookingMilestoneUpdateRequest,
): BookingMilestoneEditPatch {
  const patch: {
    dueAt?: Date | null;
    amount?: string | null;
    currency?: string | null;
    contractId?: string | null;
    documentId?: string | null;
  } = {};
  if (request.dueAt !== undefined) patch.dueAt = request.dueAt ? new Date(request.dueAt) : null;
  if (request.amount !== undefined) {
    patch.amount = request.amount ? moneyToDecimalString(request.amount) : null;
    patch.currency = request.amount ? request.amount.currency : null;
  }
  if (request.contractId !== undefined) patch.contractId = request.contractId;
  if (request.documentId !== undefined) patch.documentId = request.documentId;
  return patch;
}

/** The §9 before/after image of a milestone edit — every editable field (the FA-managed amount included,
 *  a CLIENT column, so it is safe to record), so the audit trail shows what the amount changed from/to. */
export function editMilestoneAuditImage(
  current: BookingMilestoneRow,
  patch: BookingMilestoneEditPatch,
) {
  const amountOf = (value: Prisma.Decimal | null): string | null =>
    value === null ? null : value.toString();
  const isoOf = (value: Date | null): string | null =>
    value === null ? null : value.toISOString();
  return {
    before: {
      dueAt: isoOf(current.dueAt),
      amount: amountOf(current.amount),
      contractId: current.contractId,
      documentId: current.documentId,
    },
    after: {
      dueAt: patch.dueAt === undefined ? isoOf(current.dueAt) : isoOf(patch.dueAt),
      amount: patch.amount === undefined ? amountOf(current.amount) : patch.amount,
      contractId: patch.contractId === undefined ? current.contractId : patch.contractId,
      documentId: patch.documentId === undefined ? current.documentId : patch.documentId,
    },
  };
}

/** Throws a conflict when a compare-and-swap write changed no rows (the milestone moved underneath us). */
export function assertMilestoneChanged(changed: number): void {
  if (changed === 0) {
    throw errors.conflict(
      "The milestone changed while you were working on it; reload and try again",
    );
  }
}

/** The staff scope over milestones from the guard's decision: an `assigned` PM reaches only milestones
 *  whose enquiry is in their projects (via the enquiry relation, since milestones carry a nullable
 *  project_id); SA/SM/HT/FA read all. */
export function milestoneScope(
  principal: Principal,
  access: Access,
): Prisma.BookingMilestoneWhereInput {
  if (access.scope === "assigned" && principal.type === "staff") {
    const projectIds = principal.memberships.map((membership) => membership.projectId);
    return { deletedAt: null, enquiry: { projectId: { in: projectIds } } };
  }
  return { deletedAt: null };
}

/** Emit a milestone event best-effort after the write commits; a failure is logged, never fatal (the
 *  handler-less seam for Module E/F/reporting). */
export async function emitMilestoneEvent(
  bus: EventBus,
  logger: AppLogger,
  event: DomainEvent<MilestoneEvent>,
  milestone: { id: string; enquiryId: string; milestoneType: BookingMilestoneType },
): Promise<void> {
  const payload: MilestoneEvent = {
    milestoneId: milestone.id,
    enquiryId: milestone.enquiryId,
    milestoneType: milestone.milestoneType,
  };
  await bus.emit(event, payload).catch(() =>
    logger.warn("consultancy.milestone.event_failed", {
      milestoneId: milestone.id,
      event: event.name,
    }),
  );
}
