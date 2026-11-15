import {
  formatDay,
  type BookingMilestoneStatus,
  type HotelEnquiryStaffPage,
  type HotelEnquiryStaffView,
  type HotelEnquiryStatus,
  type HotelProposalInternalView,
  type HotelProposalStatus,
  type ServiceAgreementStatus,
  type SiteVisitStatus,
} from "@ampm/core";
import { STATUS_MACHINES } from "@ampm/policy";
import type { StepState } from "@ampm/ui";

import { guestsLabel, type Badge } from "../consultancy/consultancy.format";

/*
 * Staff-audience status badges (T6, the hotel team queue). They are written out rather than spread
 * from the client maps (consultancy.format): those phrase statuses for the client ("Your decision") and
 * tone them from the client's side, while the team reads the same statuses from its own. Tones follow
 * docs/design/peacock-night.md §8: success done or confirmed, info submitted or in hand, warning
 * waiting on the hotel or the client, danger needs the team now, neutral closed or inactive.
 */

export const staffEnquiryBadge: Record<HotelEnquiryStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  awaiting_hotel: { label: "Awaiting hotel", tone: "warning" },
  response_received: { label: "Response received", tone: "info" },
  negotiating: { label: "Negotiating", tone: "warning" },
  visit_scheduled: { label: "Visit scheduled", tone: "info" },
  proposal_received: { label: "Proposal received", tone: "info" },
  client_decision: { label: "Client decision", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

/**
 * Who holds an enquiry, beside its status: nobody yet is the team's to pick up now (`danger`, needs
 * you), someone is in hand (`info`). One definition for the queue and the enquiry page.
 */
export const UNASSIGNED_BADGE: Badge = { label: "Unassigned", tone: "danger" };
export const ASSIGNED_BADGE: Badge = { label: "Assigned", tone: "info" };

/**
 * What the queue and the enquiry page say to a staff role without the consultancy grant (the API's
 * 403): not theirs, rather than a fault to retry.
 */
export const ROLE_WITHOUT_GRANT = { title: "Not available for your role" } as const;

export const staffProposalBadge: Record<HotelProposalStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  shared: { label: "Shared (awaiting client)", tone: "warning" },
  revision_requested: { label: "Revision requested", tone: "danger" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  superseded: { label: "Superseded", tone: "neutral" },
};

type Standing = Pick<HotelProposalInternalView, "status" | "sharedAt" | "decidedAt">;

/** A version's standing in words, under its title: "Shared 15 Nov 2026 · waiting for the client". */
export function proposalStanding(proposal: Standing): string {
  const on = (iso: string | null): string => (iso ? ` ${formatDay(iso)}` : "");
  switch (proposal.status) {
    case "draft":
      return "Draft · the client has not seen it yet";
    case "shared":
      return `Shared${on(proposal.sharedAt)} · waiting for the client's decision`;
    case "revision_requested":
      return "The client asked for changes · revise it as a new version";
    case "accepted":
      return `Accepted by the client${on(proposal.decidedAt)}`;
    case "declined":
      return `Declined by the client${on(proposal.decidedAt)}`;
    case "superseded":
      return "Replaced by a later version";
  }
}

const PROPOSAL_TAG: Record<HotelProposalStatus, string> = {
  draft: "draft",
  shared: "shared",
  revision_requested: "changes asked",
  accepted: "accepted",
  declined: "declined",
  superseded: "superseded",
};

/**
 * The queue's proposal tag, so the team tracks proposals without opening each enquiry: "Proposal v3 ·
 * draft", toned as the version's own badge; null before the first version.
 */
export function proposalTag(latest: HotelEnquiryStaffView["latestProposal"]): Badge | null {
  if (latest === null) return null;
  return {
    label: `Proposal v${latest.versionNumber} · ${PROPOSAL_TAG[latest.status]}`,
    tone: staffProposalBadge[latest.status].tone,
  };
}

/** A version that still stands: the API refuses a second proposal while one exists (revise it instead). */
export function isLiveProposal(status: HotelProposalStatus): boolean {
  return status !== "superseded" && status !== "declined";
}

export const staffAgreementBadge: Record<ServiceAgreementStatus, Badge> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const staffVisitBadge: Record<SiteVisitStatus, Badge> = {
  proposed: { label: "Proposed", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const staffMilestoneBadge: Record<BookingMilestoneStatus, Badge> = {
  pending: { label: "Pending", tone: "info" },
  done: { label: "Done", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** A status or outcome as button words in sentence case: "no_availability" → "No availability". */
export function statusWords(value: string): string {
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Where a site visit sits on the visits Stepper: completed done, a live one current, cancelled off. */
export const visitStepState: Record<SiteVisitStatus, StepState> = {
  proposed: "current",
  confirmed: "current",
  completed: "done",
  cancelled: "upcoming",
};

/**
 * The statuses the team still works on: the policy's "active" stretch of the enquiry machine, from
 * submitted to the client's decision (a draft is still the client's; confirmed and closed are outcomes).
 */
const OPEN_STATUSES: readonly string[] = STATUS_MACHINES["hotel_enquiry"]?.sets["active"] ?? [];

/** The queue's eyebrow, "7 open"; "7+ open" when the page holds only the newest enquiries. */
export function queueEyebrow(page: HotelEnquiryStaffPage): string {
  const open = page.items.filter((enquiry) => OPEN_STATUSES.includes(enquiry.status)).length;
  return `${open}${page.nextCursor === null ? "" : "+"} open`;
}

/** Who the enquiry is for, as the queue names it: the client account, else what is being planned. */
export function enquiryClientTitle(
  enquiry: Pick<HotelEnquiryStaffView, "accountName" | "functionsSummary">,
): string {
  return enquiry.accountName ?? enquiry.functionsSummary ?? "Hotel enquiry";
}

type QueueFields = Pick<HotelEnquiryStaffView, "guestEstimate" | "submittedAt" | "createdAt">;

/** A queue row's second line, the guests and the enquiry's age: "300 guests · submitted 3 Nov 2026". */
export function enquiryQueueLine(enquiry: QueueFields): string {
  const age = enquiry.submittedAt
    ? `submitted ${formatDay(enquiry.submittedAt)}`
    : `created ${formatDay(enquiry.createdAt)}`;
  return `${guestsLabel(enquiry.guestEstimate)} · ${age}`;
}
