import {
  errors,
  hotelFormRequestStatus,
  isLiveHotelInfoRequestStatus,
  type HotelFormLinkState,
  type HotelFormMode,
  type HotelFormRequestView,
  type HotelInfoRequestStatus,
} from "@ampm/core";

import { modeAdmits } from "../hotel-form-email-gate.js";

/*
 * What a hotel form link opens to (D-189 §4 and §5; plan §4.2), pure: `open` answers it, and the code
 * routes and the session guard re-check it on every call. The mode is read fresh by the caller; `off`
 * answers 404 before anything here is asked, and here admits nothing.
 */

/** What the form reads of a request: its state, its link's generation, and AMPM's label and note. */
export interface FormRequest {
  readonly id: string;
  readonly isTest: boolean;
  readonly status: HotelInfoRequestStatus;
  readonly expiresAt: Date;
  readonly statusOnlyUntil: Date | null;
  readonly tokenGeneration: number;
  readonly displayLabel: string | null;
  readonly staffNote: string | null;
  /** Whether the hotel the request names was deleted; false for a new hotel's request. */
  readonly hotelDeleted: boolean;
}

/** A live status's state while its link has not expired. */
function liveState(request: FormRequest, now: Date): HotelFormLinkState {
  if (request.expiresAt.getTime() <= now.getTime()) return "not_active";
  return request.status === "open" || request.status === "changes_requested" ? "ready" : "locked";
}

/**
 * The link's state at `now`: `ready` (open or changes requested), `locked` (submitted or in review),
 * `status_only` (merged, inside the window), else `not_active` (no request, expired, rejected, revoked,
 * a deleted hotel, or a request the mode does not admit).
 *
 * @example
 * linkStateOf(request, policy.mode, new Date()); // "ready"
 */
export function linkStateOf(
  request: FormRequest | null,
  mode: HotelFormMode,
  now: Date,
): HotelFormLinkState {
  if (request === null || request.hotelDeleted || !modeAdmits(mode, request.isTest)) {
    return "not_active";
  }
  if (isLiveHotelInfoRequestStatus(request.status)) return liveState(request, now);
  const inWindow =
    request.status === "merged" &&
    request.statusOnlyUntil !== null &&
    request.statusOnlyUntil.getTime() > now.getTime();
  return inWindow ? "status_only" : "not_active";
}

/** When the link stops working: its expiry, or once merged the end of the status-only window. */
export function linkClosesAt(request: FormRequest): Date {
  return request.status === "merged" && request.statusOnlyUntil !== null
    ? request.statusOnlyUntil
    : request.expiresAt;
}

/**
 * The request as a signed-in person sees it (core `hotelFormRequestView`). Only for a request whose state
 * is not `not_active`: any other status is a programming error.
 */
export function requestViewOf(request: FormRequest): HotelFormRequestView {
  const status = hotelFormRequestStatus.safeParse(request.status);
  if (!status.success) throw errors.internal("A closed request has no form view");
  return {
    displayLabel: request.displayLabel,
    staffNote: request.staffNote,
    status: status.data,
    expiresAt: linkClosesAt(request).toISOString(),
  };
}
