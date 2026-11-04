import type { HotelEnquiryStaffUpdateRequest } from "@ampm/core";

import type { Principal } from "../../policy/principal.types.js";

const INHERENTLY_INTERNAL_EVENTS: ReadonlySet<string> = new Set([
  "sent_to_hotel",
  "hotel_response",
  "negotiation_note",
]);

/** Event types whose content is internal negotiation detail; always hidden from the client timeline. */
export function isInherentlyInternalEvent(eventType: string): boolean {
  return INHERENTLY_INTERNAL_EVENTS.has(eventType);
}

/** The defined fields of a staff enquiry update, so an omitted field is left untouched. */
export function buildStaffPatch(request: HotelEnquiryStaffUpdateRequest): {
  assignedUserId?: string | null;
  notesInternal?: string | null;
} {
  const patch: { assignedUserId?: string | null; notesInternal?: string | null } = {};
  if (request.assignedUserId !== undefined) patch.assignedUserId = request.assignedUserId;
  if (request.notesInternal !== undefined) patch.notesInternal = request.notesInternal;
  return patch;
}

/** The acting staff user's id; a non-staff principal never reaches these guarded routes. */
export function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}
