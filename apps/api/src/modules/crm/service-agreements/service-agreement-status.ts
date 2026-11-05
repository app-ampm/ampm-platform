import type { ServiceAgreementStatus } from "@ampm/core";

/**
 * The service-agreement status machine (feature 10.2). §7 of the permission matrix has no
 * service_agreement rows, so the commercial lifecycle is enforced in the service through these pure
 * rules (the lead-funnel pattern, lead-status.ts): draft → sent → accepted → active → completed, with
 * `cancelled` reachable from any non-terminal state. `accepted` is reached by the client's accept or a
 * staff mark-offline; `active` is the state that grants the service's entitlement module (data-model
 * §4, GP-5). completed and cancelled are terminal. Same-status is not a transition (each move audits).
 */

/** A completed or cancelled agreement is terminal: no further moves or edits. */
export const TERMINAL_AGREEMENT_STATUSES: readonly ServiceAgreementStatus[] = [
  "completed",
  "cancelled",
];

const AGREEMENT_TRANSITIONS: Record<ServiceAgreementStatus, readonly ServiceAgreementStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "cancelled"],
  accepted: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** True when an agreement in `status` is terminal (completed or cancelled) and so read-only. */
export function isTerminalAgreement(status: ServiceAgreementStatus): boolean {
  return TERMINAL_AGREEMENT_STATUSES.includes(status);
}

/** True when moving an agreement from `from` to `to` is a defined move (never a same-status no-op). */
export function isAgreementTransitionAllowed(
  from: ServiceAgreementStatus,
  to: ServiceAgreementStatus,
): boolean {
  return AGREEMENT_TRANSITIONS[from].includes(to);
}

/**
 * Whether a move changes the account's `hotel_assistance` entitlement: entering `active` turns the
 * agreement's module on, leaving `active` turns it off (data-model §4). Either way the entitlement
 * cache for the account's client users must be invalidated so the next request recomputes it.
 */
export function agreementAffectsEntitlement(
  from: ServiceAgreementStatus,
  to: ServiceAgreementStatus,
): boolean {
  return to === "active" || from === "active";
}
