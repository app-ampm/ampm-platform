import type { SiteVisitStatus } from "@ampm/core";

/**
 * The site-visit status machine (feature 10.3). §7 of the permission matrix has no site_visit rows, so
 * the visit lifecycle is enforced in the service through these pure rules (the service-agreement /
 * lead-funnel pattern): proposed → confirmed → completed, with `cancelled` reachable from any
 * non-terminal state; completed and cancelled are terminal. Same-status is not a transition (each move
 * audits). Scheduling the first visit advances the enquiry to `visit_scheduled` (the 10.1 machine).
 */

/** A completed or cancelled visit is terminal: no further moves or edits. */
export const TERMINAL_VISIT_STATUSES: readonly SiteVisitStatus[] = ["completed", "cancelled"];

const VISIT_TRANSITIONS: Record<SiteVisitStatus, readonly SiteVisitStatus[]> = {
  proposed: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** True when a visit in `status` is terminal (completed or cancelled) and so read-only. */
export function isTerminalVisit(status: SiteVisitStatus): boolean {
  return TERMINAL_VISIT_STATUSES.includes(status);
}

/** True when moving a visit from `from` to `to` is a defined move (never a same-status no-op). */
export function isVisitTransitionAllowed(from: SiteVisitStatus, to: SiteVisitStatus): boolean {
  return VISIT_TRANSITIONS[from].includes(to);
}
