import type {
  HotelProposalClientView,
  HotelProposalInternalView,
  HotelProposalLineClientView,
  HotelProposalLineView,
} from "@ampm/core";

import { deriveMargin, toClientMoney, toInternalMoney } from "./proposals.money.js";
import type { ProposalLineRow, ProposalRow } from "./proposals.repository.js";

/**
 * One serialiser per audience (security.md). The client view carries the client total + `client_visible`
 * lines only; the internal total, the DERIVED margin and the non-visible lines are ABSENT, never a
 * hide-flag (AC-05.2). The internal view adds the internal total + margin ONLY when `withInternalAmount`
 * (the reader holds `consultancy.proposals.read_internal_amount`) — else they are left off, like
 * `notesInternal` for a reader without the enquiry-notes grant.
 */

const iso = (date: Date): string => date.toISOString();
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

function lineClient(row: ProposalLineRow): HotelProposalLineClientView {
  return {
    id: row.id,
    itemType: row.itemType,
    description: row.description,
    quantity: row.quantity.toNumber(),
    unitAmount: toClientMoney(row.unitAmount),
    totalAmount: toClientMoney(row.totalAmount),
  };
}

function lineStaff(row: ProposalLineRow): HotelProposalLineView {
  return { ...lineClient(row), proposalId: row.proposalId, clientVisible: row.clientVisible };
}

function scalars(row: ProposalRow) {
  return {
    id: row.id,
    enquiryId: row.enquiryId,
    hotelId: row.hotelId,
    versionNumber: row.versionNumber,
    status: row.status,
    validUntil: row.validUntil ? dateOnly(row.validUntil) : null,
    clientTotal: toClientMoney(row.clientTotalAmount), // only the CLIENT column, ever
    currency: row.currency,
    documentId: row.documentId,
    sharedAt: row.sharedAt ? iso(row.sharedAt) : null,
    decidedAt: row.decidedAt ? iso(row.decidedAt) : null,
    supersedesProposalId: row.supersedesProposalId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toProposalClientView(row: ProposalRow): HotelProposalClientView {
  return {
    ...scalars(row),
    lines: row.lines.filter((line) => line.clientVisible).map(lineClient),
  };
}

export function toProposalInternalView(
  row: ProposalRow,
  withInternalAmount: boolean,
): HotelProposalInternalView {
  const base: HotelProposalInternalView = {
    ...scalars(row),
    decidedByUserId: row.decidedByUserId,
    approvalId: row.approvalId,
    createdBy: row.createdBy,
    lines: row.lines.map(lineStaff), // ALL lines for staff
  };
  if (!withInternalAmount) return base;
  return {
    ...base,
    internalTotal: toInternalMoney(row.internalTotalAmount),
    margin: deriveMargin(row.clientTotalAmount, row.internalTotalAmount),
  };
}
