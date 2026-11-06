import type {
  BookingMilestoneStatus,
  BookingMilestoneType,
  HotelEnquiryStatus,
  HotelProposalStatus,
  ServiceAgreementStatus,
  SiteVisitStatus,
} from "@ampm/core";

/** A StatusChip tone (packages/ui status-chip). */
type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

/** A status rendered as a labelled, toned chip. */
export interface Badge {
  readonly label: string;
  readonly tone: Tone;
}

export const enquiryBadge: Record<HotelEnquiryStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  awaiting_hotel: { label: "Awaiting hotel", tone: "info" },
  response_received: { label: "Response received", tone: "info" },
  negotiating: { label: "Negotiating", tone: "warning" },
  visit_scheduled: { label: "Visit scheduled", tone: "info" },
  proposal_received: { label: "Proposal received", tone: "brand" },
  client_decision: { label: "Your decision", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export const agreementBadge: Record<ServiceAgreementStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Action needed", tone: "warning" },
  accepted: { label: "Accepted", tone: "info" },
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const visitBadge: Record<SiteVisitStatus, Badge> = {
  proposed: { label: "Proposed", tone: "info" },
  confirmed: { label: "Confirmed", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const proposalBadge: Record<HotelProposalStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  shared: { label: "Awaiting your decision", tone: "brand" },
  revision_requested: { label: "Revision requested", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  superseded: { label: "Superseded", tone: "neutral" },
};

export const milestoneBadge: Record<BookingMilestoneStatus, Badge> = {
  pending: { label: "Pending", tone: "neutral" },
  done: { label: "Done", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const MILESTONE_TYPE_LABEL: Record<BookingMilestoneType, string> = {
  hold_placed: "Hold placed",
  contract_sent: "Contract sent",
  contract_signed: "Contract signed",
  advance_paid: "Advance payment",
  rooming_list_due: "Rooming list",
  balance_due: "Balance due",
  confirmed: "Confirmed booking",
};

export function milestoneTypeLabel(type: BookingMilestoneType): string {
  return MILESTONE_TYPE_LABEL[type];
}

const EVENT_LABEL: Record<string, string> = {
  submitted: "Request submitted",
  sent_to_hotel: "Sent to the hotel",
  hotel_response: "Hotel responded",
  negotiation_note: "Negotiation update",
  client_update: "Update",
  status_change: "Status changed",
  visit: "Site visit",
  proposal: "Proposal",
};

/** A human label for a client-visible timeline event type. */
export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type.replace(/_/g, " ");
}

/** A short calendar date; the wire sends an ISO date or datetime. Falls back to the raw string. */
export function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** A date range for an enquiry's stay. */
export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}
