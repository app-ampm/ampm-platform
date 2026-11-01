import type { LeadStatus } from "@ampm/core";

/**
 * The lead status machine (C3). §7 of the permission matrix has no lead rows, so the sales lifecycle is
 * enforced in the service through these pure rules: a lead moves forward through the funnel or closes,
 * `follow_up` may re-engage an earlier active stage, and `closed`/`converted` are terminal (reached only
 * through close and the 8.2 convert action). Kept apart from the service so the convert flow can reuse it.
 */

/** Past `new`, a lead must have an owner to receive follow-up reminders (field-matrix leads.owner_user_id). */
export const OWNED_STATUSES: readonly LeadStatus[] = [
  "contacted",
  "introduction_shared",
  "demo_offered",
  "demo_accessed",
  "follow_up",
];

/** A closed or converted lead is terminal: no field edits, owner changes, activities or status moves. */
export const TERMINAL_STATUSES: readonly LeadStatus[] = ["closed", "converted"];

/** The moves each status may make; a move not listed is refused. `converted` is reached only via convert. */
const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted", "introduction_shared", "demo_offered", "demo_accessed", "follow_up", "closed"],
  contacted: ["introduction_shared", "demo_offered", "demo_accessed", "follow_up", "closed"],
  introduction_shared: ["demo_offered", "demo_accessed", "follow_up", "closed"],
  demo_offered: ["demo_accessed", "follow_up", "closed"],
  demo_accessed: ["follow_up", "closed"],
  follow_up: ["contacted", "introduction_shared", "demo_offered", "demo_accessed", "closed"],
  converted: [],
  closed: [],
};

/** True when a lead in `status` is terminal (closed or converted) and so read-only. */
export function isTerminalLead(status: LeadStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** True when moving a lead from `from` to `to` is allowed (a same-status no-op always is). */
export function isLeadTransitionAllowed(from: LeadStatus, to: LeadStatus): boolean {
  return from === to || LEAD_TRANSITIONS[from].includes(to);
}
