import { MATRIX } from "@ampm/policy";
import type { HotelEnquiryStatus } from "@ampm/core";

/**
 * Module-local reads of the hotel_enquiry lifecycle. The authz (who may move a record) + the transition
 * graph live in `@ampm/policy` (statuses.ts, generated matrix.json §7); these helpers only *read* that
 * graph so the service can tell an illegal transition (409) from one the principal may not make (403),
 * and enforce the data-dependent guards §7 leaves to the service. No status table is hand-written here.
 */

const ENTITY = "hotel_enquiry";

/** The machine's only terminal status (statuses.ts `terminal: ["closed"]`). */
export const TERMINAL_ENQUIRY_STATUS: HotelEnquiryStatus = "closed";

/**
 * The statuses whose entry sends the client exactly one notification (AC-05.3). The purely internal
 * steps (`awaiting_hotel`, `negotiating`) do not notify the client; `draft` is never entered by a move.
 */
export const CLIENT_VISIBLE_STATUSES: ReadonlySet<HotelEnquiryStatus> = new Set([
  "submitted",
  "response_received",
  "visit_scheduled",
  "proposal_received",
  "client_decision",
  "confirmed",
  "closed",
]);

/** Whether §7 defines any rule reaching `from → to` for the enquiry, ignoring the principal. */
export function isEnquiryTransitionDefined(from: string, to: string): boolean {
  if (from === to) return false;
  return MATRIX.transitions.some(
    (rule) => rule.entity === ENTITY && rule.from.includes(from) && rule.to.includes(to),
  );
}

export function isTerminalEnquiry(status: HotelEnquiryStatus): boolean {
  return status === TERMINAL_ENQUIRY_STATUS;
}

export function isClientVisibleStatus(status: HotelEnquiryStatus): boolean {
  return CLIENT_VISIBLE_STATUSES.has(status);
}
