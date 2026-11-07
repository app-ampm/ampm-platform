import {
  formatDay,
  formatDayRange,
  type BookingMilestoneStatus,
  type BookingMilestoneType,
  type HotelEnquiryOutcome,
  type HotelEnquiryStatus,
  type HotelProposalStatus,
  type ServiceAgreementStatus,
  type SiteVisitStatus,
} from "@ampm/core";
import type { StatusTone, StepState } from "@ampm/ui";

/** A status rendered as a labelled, toned StatusChip (docs/design/peacock-night.md §8). */
export interface Badge {
  readonly label: string;
  readonly tone: StatusTone;
}

/*
 * The client's chips, in Peacock Night's five treatments: `info` submitted or indicative, `warning`
 * waiting on the hotel or AMPM, `success` reached, verified or done, `danger` needs the client,
 * `neutral` closed or inactive. The staff screens keep their own maps (consultancy-admin.format),
 * worded and toned from the team's side.
 */

export const enquiryBadge: Record<HotelEnquiryStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  awaiting_hotel: { label: "Awaiting hotel", tone: "warning" },
  response_received: { label: "Response received", tone: "success" },
  negotiating: { label: "Negotiating", tone: "warning" },
  visit_scheduled: { label: "Visit scheduled", tone: "success" },
  proposal_received: { label: "Proposal received", tone: "success" },
  client_decision: { label: "Your decision", tone: "danger" },
  confirmed: { label: "Confirmed", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

/** A closed enquiry says how it closed: "Not available" rather than a bare "Closed" (D8). */
const CLOSED_BADGE: Record<HotelEnquiryOutcome, Badge> = {
  booked: { label: "Booked", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  no_availability: { label: "Not available", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

interface EnquiryState {
  readonly status: HotelEnquiryStatus;
  readonly outcome: HotelEnquiryOutcome | null;
}

/** The chip for one of the client's enquiries: its status, or for a closed one its outcome. */
export function enquiryChip(enquiry: EnquiryState): Badge {
  if (enquiry.status === "closed" && enquiry.outcome) return CLOSED_BADGE[enquiry.outcome];
  return enquiryBadge[enquiry.status];
}

export const agreementBadge: Record<ServiceAgreementStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Action needed", tone: "danger" },
  // Accepted by the client, waiting for AMPM to activate it.
  accepted: { label: "Accepted", tone: "warning" },
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const visitBadge: Record<SiteVisitStatus, Badge> = {
  proposed: { label: "Proposed", tone: "info" },
  confirmed: { label: "Confirmed", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const proposalBadge: Record<HotelProposalStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  shared: { label: "Awaiting your decision", tone: "danger" },
  revision_requested: { label: "Revision requested", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  superseded: { label: "Superseded", tone: "neutral" },
};

export const milestoneBadge: Record<BookingMilestoneStatus, Badge> = {
  pending: { label: "Pending", tone: "info" },
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

/** The client's view of an enquiry's progress (D8): five steps over the ten statuses. */
export const ENQUIRY_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "checking", label: "Checking" },
  { key: "available", label: "Available" },
  { key: "proposal", label: "Proposal shared" },
  { key: "decision", label: "Your decision" },
] as const;

/**
 * The step each status stands at, in the machine's order (packages/policy statuses.ts): the hotel's
 * answer ends "Checking", negotiating and a site visit happen while it is available, and a confirmed
 * enquiry has every step done.
 */
const ENQUIRY_STEP_AT: Record<HotelEnquiryStatus, number> = {
  draft: -1,
  submitted: 0,
  awaiting_hotel: 1,
  response_received: 2,
  negotiating: 2,
  visit_scheduled: 2,
  proposal_received: 3,
  client_decision: 4,
  confirmed: ENQUIRY_STEPS.length,
  closed: ENQUIRY_STEPS.length,
};

/**
 * The Stepper's `current` for an enquiry: the steps before it are done. Null for an enquiry closed
 * without a booking: its chip says how it closed, and a stepper stopped part-way would read as work
 * still in progress.
 */
export function enquiryStep(enquiry: EnquiryState): number | null {
  if (enquiry.status === "closed" && enquiry.outcome !== "booked") return null;
  return ENQUIRY_STEP_AT[enquiry.status];
}

/**
 * Each booking milestone's Stepper state, in the order given. Milestones finish out of order, so each
 * carries its own: done ones done, the first open one (what comes next) and every overdue one current,
 * the rest upcoming. The staff screens (consultancy-admin.format) read them the same way.
 */
export function milestoneStepStates(statuses: readonly BookingMilestoneStatus[]): StepState[] {
  const next = statuses.findIndex((status) => status === "pending" || status === "overdue");
  return statuses.map((status, index) => {
    if (status === "done") return "done";
    return status === "overdue" || index === next ? "current" : "upcoming";
  });
}

export function guestsLabel(count: number): string {
  return count === 1 ? "1 guest" : `${count} guests`;
}

interface EnquiryFacts {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly datesFlexible: boolean;
  readonly guestEstimate: number;
  readonly roomsRequired: number | null;
}

/** An enquiry's stay as one data line: "12–14 FEB 2027 · 300 guests · 80 rooms · Flexible dates". */
export function enquiryFacts(enquiry: EnquiryFacts): string {
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo, { style: "data" });
  const parts = [stay, guestsLabel(enquiry.guestEstimate)];
  if (enquiry.roomsRequired) parts.push(`${enquiry.roomsRequired} rooms`);
  if (enquiry.datesFlexible) parts.push("Flexible dates");
  return parts.join(" · ");
}

/**
 * A site visit's day or a milestone's due date, "31 Jan 2027": a day staff pick in the form, which
 * goes out as midnight UTC (consultancy-admin.form.ts), so it is read as written. Read as a moment,
 * a time zone west of Greenwich would show the day before. Both audiences' screens use it.
 */
export function formatPickedDay(iso: string): string {
  return formatDay(iso, { day: "written" });
}

interface ProposalDates {
  readonly sharedAt: string | null;
  readonly validUntil: string | null;
}

/**
 * A proposal's dates as one data line, "Shared 3 NOV 2026 · Valid until 20 NOV 2026", or null when
 * the proposal carries neither date.
 */
export function proposalDates(proposal: ProposalDates): string | null {
  const parts: string[] = [];
  if (proposal.sharedAt) parts.push(`Shared ${formatDay(proposal.sharedAt, { style: "data" })}`);
  if (proposal.validUntil)
    parts.push(`Valid until ${formatDay(proposal.validUntil, { style: "data" })}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
