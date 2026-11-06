import type { HotelProposalStatus } from "@ampm/core";

/**
 * The hotel-proposal status machine (feature 10.4). §7 of the permission matrix has no proposal rows, so
 * the lifecycle is enforced in the service through these pure rules (the site-visit / lead-funnel
 * pattern): draft → shared → accepted | declined | revision_requested; a revision issues a new version
 * that supersedes its predecessor (shared or revision_requested → superseded). accepted, declined and
 * superseded are terminal. Content is immutable once past `draft` (a change is a new version) — that
 * rule lives in the service's draft-only edit guard, separate from these transition rules.
 */

/** A decided or superseded proposal is terminal: no further status moves. */
export const TERMINAL_PROPOSAL_STATUSES: readonly HotelProposalStatus[] = [
  "accepted",
  "declined",
  "superseded",
];

const PROPOSAL_TRANSITIONS: Record<HotelProposalStatus, readonly HotelProposalStatus[]> = {
  draft: ["shared"],
  shared: ["revision_requested", "accepted", "declined", "superseded"],
  revision_requested: ["superseded"],
  accepted: [],
  declined: [],
  superseded: [],
};

/** True when a proposal in `status` is terminal and so admits no further status move. */
export function isTerminalProposal(status: HotelProposalStatus): boolean {
  return TERMINAL_PROPOSAL_STATUSES.includes(status);
}

/** True when moving a proposal from `from` to `to` is a defined move (never a same-status no-op). */
export function isProposalTransitionAllowed(
  from: HotelProposalStatus,
  to: HotelProposalStatus,
): boolean {
  return PROPOSAL_TRANSITIONS[from].includes(to);
}
