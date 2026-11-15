import {
  hotelEnquiryStageOf,
  type HotelEnquiryStaffView,
  type HotelEnquiryStage,
} from "@ampm/core";
import type { CalloutKind, StepperStep } from "@ampm/ui";

import { statusWords } from "./consultancy-admin.format";

/**
 * The staff pipeline as the enquiry page reads it (pure, so it is tested without rendering): the five
 * steps of its stepper, which one the enquiry is on, and the one thing the team should do next, said
 * from the enquiry's status and its newest proposal. The words are the team's, not the client's.
 */

/** The enquiry page's sections, one tab each. */
export type EnquiryTab = "overview" | "proposals" | "activity" | "booking";

/** The stages the stepper walks; `closed` is an outcome said in the next step, not a step. */
export const PIPELINE_STEPS: ReadonlyArray<StepperStep & { readonly key: HotelEnquiryStage }> = [
  { key: "new", label: "New request" },
  { key: "with_hotel", label: "With the hotel" },
  { key: "proposal", label: "Proposal" },
  { key: "client_decision", label: "Client decision" },
  { key: "confirmed", label: "Confirmed" },
];

/** The stage names the queue's filter shows, in pipeline order. */
export const STAGE_LABEL: Record<HotelEnquiryStage, string> = {
  new: "New",
  with_hotel: "With hotel",
  proposal: "Proposal",
  client_decision: "Client decision",
  confirmed: "Confirmed",
  closed: "Closed",
};

/** The stepper's current index: a closed enquiry has walked every step it reached, so all show done. */
export function pipelineIndex(status: HotelEnquiryStaffView["status"]): number {
  const stage = hotelEnquiryStageOf(status);
  if (stage === "closed") return PIPELINE_STEPS.length;
  return PIPELINE_STEPS.findIndex((step) => step.key === stage);
}

export interface NextStep {
  readonly kind: CalloutKind;
  readonly title: string;
  readonly detail: string;
  /** The tab that holds the work, if it is not the one already open. */
  readonly tab: EnquiryTab | null;
}

type Enquiry = Pick<HotelEnquiryStaffView, "status" | "outcome" | "latestProposal">;

type ProposalStatus = NonNullable<Enquiry["latestProposal"]>["status"];

/** What each standing of the newest version asks of the team; a superseded one asks nothing. */
const PROPOSAL_STEPS: Record<ProposalStatus, ((n: number) => NextStep) | null> = {
  draft: (n) => ({
    kind: "warning",
    title: `Version ${n} is a draft`,
    detail: "Check it, edit it if anything changed, then share it with the client.",
    tab: "proposals",
  }),
  revision_requested: (n) => ({
    kind: "danger",
    title: "The client asked for changes",
    detail: `Revise version ${n} as a new version, edit it and share it again.`,
    tab: "proposals",
  }),
  shared: (n) => ({
    kind: "awaiting-confirmation",
    title: "Waiting for the client",
    detail: `Version ${n} is with the client to accept, decline or ask for changes.`,
    tab: "proposals",
  }),
  accepted: (n) => ({
    kind: "success",
    title: `The client accepted version ${n}`,
    detail: "Record the booking milestones, then confirm the enquiry.",
    tab: "booking",
  }),
  declined: (n) => ({
    kind: "info",
    title: `The client declined version ${n}`,
    detail: "Draft a fresh proposal, or close the enquiry if they have moved on.",
    tab: "proposals",
  }),
  superseded: null,
};

/** What the newest proposal asks of the team, while the enquiry is still open; null if it asks nothing. */
function proposalStep(enquiry: Enquiry): NextStep | null {
  const proposal = enquiry.latestProposal;
  if (proposal === null) return null;
  return PROPOSAL_STEPS[proposal.status]?.(proposal.versionNumber) ?? null;
}

/** Before any proposal: what the stage the enquiry is at asks of the team. */
function stageStep(stage: HotelEnquiryStage): NextStep {
  switch (stage) {
    case "new":
      return {
        kind: "danger",
        title: "New request",
        detail: "Read what the client asked for, contact the hotel and move it to Awaiting hotel.",
        tab: "overview",
      };
    case "with_hotel":
      return {
        kind: "info",
        title: "With the hotel",
        detail: "Log the hotel's replies in Activity. When it quotes, draft the client's proposal.",
        tab: "proposals",
      };
    default:
      return {
        kind: "warning",
        title: "Draft the client's proposal",
        detail: "The hotel has quoted: put the offer together and share it with the client.",
        tab: "proposals",
      };
  }
}

/** The one next step the enquiry page leads with. */
export function nextStep(enquiry: Enquiry): NextStep {
  const stage = hotelEnquiryStageOf(enquiry.status);
  if (stage === "closed") {
    const outcome = enquiry.outcome ? ` · ${statusWords(enquiry.outcome)}` : "";
    return {
      kind: "info",
      title: `Closed${outcome}`,
      detail: "Nothing more to do. The history stays here for reference.",
      tab: null,
    };
  }
  if (stage === "confirmed")
    return {
      kind: "success",
      title: "Booking confirmed",
      detail: "Keep the milestones up to date until the event.",
      tab: "booking",
    };
  return proposalStep(enquiry) ?? stageStep(stage);
}

/** The tab an enquiry opens on: where its next step is, else its overview. */
export function initialTab(enquiry: Enquiry): EnquiryTab {
  const step = nextStep(enquiry);
  return step.tab === "proposals" && enquiry.latestProposal !== null ? "proposals" : "overview";
}
