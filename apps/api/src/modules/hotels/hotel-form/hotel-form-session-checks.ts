import type { HotelFormMode, HotelFormSessionRefusal } from "@ampm/core";

import { isSessionExpired } from "./hotel-form-session-rules.js";
import type { SessionRecord } from "./hotel-form-sessions.repository.js";
import { linkStateOf } from "./hotel-form-state.js";

/**
 * Why a form session is refused at `now`, or null when it passes (D-189 §5): the re-checks of every call,
 * coarsest first, so a page whose link is gone goes straight to HF-08 rather than asking for a code the
 * code route would refuse. The request: deleted, its hotel deleted, its status and expiry, the status-only
 * window, and the mode (read fresh by the caller; `off` is a 404 before this); then the link's generation
 * (a reissue ends every session of the old link); the person (removed or deleted); and the session itself
 * (ended, 2 hours idle, 12 hours in all).
 *
 * @example
 * const reason = sessionRefusal(record, policy.mode, now);
 * if (reason) throw hotelFormSessionError(reason);
 */
export function sessionRefusal(
  record: SessionRecord,
  mode: HotelFormMode,
  now: Date,
): HotelFormSessionRefusal | null {
  if (linkStateOf(record.request, mode, now) === "not_active") return "not_active";
  if (record.linkGeneration !== record.request?.tokenGeneration) return "link_changed";
  if (record.person.isGone) return "person_removed";
  if (record.endedAt !== null) return "session_ended";
  if (isSessionExpired(record, now)) return "session_expired";
  return null;
}
