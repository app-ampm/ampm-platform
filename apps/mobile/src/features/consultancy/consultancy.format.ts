import type {
  BookingMilestoneStatus,
  BookingMilestoneType,
  HotelEnquiryOutcome,
  HotelEnquiryStatus,
  HotelProposalStatus,
  ServiceAgreementStatus,
  SiteVisitStatus,
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

const LOCALE = "en-IN";

/**
 * A wire date ("2027-02-12") as a local calendar date. `new Date("2027-02-12")` is midnight UTC, which
 * a time zone west of Greenwich shows as the day before.
 */
function calendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A short calendar date; the wire sends an ISO date or datetime. Falls back to the raw string. */
export function formatDate(iso: string): string {
  const parsed = calendarDate(iso) ?? new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

/** A date range for an enquiry's stay. */
export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function dayMonth(date: Date, withYear: boolean): string {
  return date.toLocaleDateString(
    LOCALE,
    withYear
      ? { day: "numeric", month: "short", year: "numeric" }
      : { day: "numeric", month: "short" },
  );
}

/**
 * A stay's dates, compact (D8): "12–14 Feb 2027", "28 Feb – 2 Mar 2027", "30 Dec 2026 – 2 Jan 2027".
 * Values that are not calendar dates fall back to the long range.
 */
export function formatStay(from: string, to: string): string {
  const start = calendarDate(from);
  const end = calendarDate(to);
  if (!start || !end) return formatDateRange(from, to);
  if (start.getFullYear() !== end.getFullYear())
    return `${dayMonth(start, true)} – ${dayMonth(end, true)}`;
  if (start.getMonth() !== end.getMonth())
    return `${dayMonth(start, false)} – ${dayMonth(end, true)}`;
  if (start.getDate() === end.getDate()) return dayMonth(end, true);
  return `${start.getDate()}–${dayMonth(end, true)}`;
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

/** An enquiry's stay as one data line: "12–14 Feb 2027 · 300 guests · 80 rooms · Flexible dates". */
export function enquiryFacts(enquiry: EnquiryFacts): string {
  const parts = [formatStay(enquiry.dateFrom, enquiry.dateTo), guestsLabel(enquiry.guestEstimate)];
  if (enquiry.roomsRequired) parts.push(`${enquiry.roomsRequired} rooms`);
  if (enquiry.datesFlexible) parts.push("Flexible dates");
  return parts.join(" · ");
}

interface ProposalDates {
  readonly sharedAt: string | null;
  readonly validUntil: string | null;
}

/** "Shared 3 Nov 2026 · Valid until 20 Nov 2026", or null when the proposal carries neither date. */
export function proposalDates(proposal: ProposalDates): string | null {
  const parts: string[] = [];
  if (proposal.sharedAt) parts.push(`Shared ${formatDate(proposal.sharedAt)}`);
  if (proposal.validUntil) parts.push(`Valid until ${formatDate(proposal.validUntil)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
