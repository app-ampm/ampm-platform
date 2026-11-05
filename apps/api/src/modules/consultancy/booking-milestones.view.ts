import type { BookingMilestoneClientView, BookingMilestoneStaffView } from "@ampm/core";

import { toClientMoney } from "./booking-milestones.money.js";
import type { BookingMilestoneRow } from "./booking-milestones.repository.js";

/**
 * One serialiser per audience (security.md). The staff view always carries the amount (nullable) plus the
 * internal references and the creator. The client view carries type, status and dates, and the amount ONLY
 * when the W-14 config flag is on and the milestone has one (ABSENT otherwise, never a hide-flag) — the
 * contract/document/project references and the creator never reach a client. The return type is the
 * `@ampm/core` view, so TypeScript rejects any stray field.
 */

function iso(date: Date): string {
  return date.toISOString();
}

function scalars(row: BookingMilestoneRow) {
  return {
    id: row.id,
    enquiryId: row.enquiryId,
    milestoneType: row.milestoneType,
    status: row.status,
    dueAt: row.dueAt ? iso(row.dueAt) : null,
    completedAt: row.completedAt ? iso(row.completedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toBookingMilestoneClientView(
  row: BookingMilestoneRow,
  amountsVisible: boolean,
): BookingMilestoneClientView {
  const base = scalars(row);
  // W-14: the amount reaches the client only where AMPM has confirmed they pay the hotel directly.
  if (!amountsVisible || row.amount === null) return base;
  return { ...base, amount: toClientMoney(row.amount) };
}

export function toBookingMilestoneStaffView(row: BookingMilestoneRow): BookingMilestoneStaffView {
  return {
    ...scalars(row),
    amount: row.amount === null ? null : toClientMoney(row.amount),
    projectId: row.projectId,
    contractId: row.contractId,
    documentId: row.documentId,
    createdBy: row.createdBy,
  };
}
