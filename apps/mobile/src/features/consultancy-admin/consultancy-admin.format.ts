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

type Holder = Pick<HotelEnquiryStaffView, "assignedUserId" | "assignedUserName">;

/** The holder's name, or null while nobody holds the enquiry (or their record is gone). */
export function holderName(enquiry: Holder): string | null {
  return enquiry.assignedUserId === null ? null : enquiry.assignedUserName;
}

/** A first name and the last name's initial, as the admin artboards write owners: "Hema H.". */
export function shortPersonName(name: string): string {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

/**
 * Who holds an enquiry as a chip in the queue: the gold "Unassigned" while it is the team's to pick
 * up, else the holder's short name in peacock ("Hema H."; "Assigned" when their name is unknown).
 */
export function holderBadge(enquiry: Holder): Badge {
  if (enquiry.assignedUserId === null) return UNASSIGNED_BADGE;
  const name = holderName(enquiry);
  return name ? { label: shortPersonName(name), tone: ASSIGNED_BADGE.tone } : ASSIGNED_BADGE;
}

/** The holder for a screen reader, in full: "Unassigned", "Held by Hema Hotels". */
export function holderSpoken(enquiry: Holder): string {
  if (enquiry.assignedUserId === null) return UNASSIGNED_BADGE.label;
  const name = holderName(enquiry);
  return name ? `Held by ${name}` : ASSIGNED_BADGE.label;
}

/** The line under the owner's name on the enquiry's overview. */
export function ownerCaption(held: boolean, isMine: boolean): string {
  if (!held) return "Nobody on the hotel team has picked this enquiry up yet.";
  return isMine
    ? "You hold this enquiry: its next steps are yours."
    : "Holds this enquiry for the hotel team.";
}

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
  // Read from the team's side: a sent agreement waits on the client; an accepted one needs the team now.
  sent: { label: "Sent · awaiting client", tone: "warning" },
  accepted: { label: "Accepted · activate it", tone: "danger" },
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
