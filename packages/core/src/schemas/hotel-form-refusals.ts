import { z } from "zod";

import { AppError, type ErrorDetail } from "../errors.js";

/*
 * How the hotel form's public routes refuse (D-189 §3 to §5; the form's own, D-190 §3). The envelope has a
 * code and a message, so the API raises these exact messages and the page shows them. A session's 401 also carries a reason code,
 * in the envelope's `details` as `{ path: "reason", message: <reason> }`, which the page reads with
 * `hotelFormSessionRefusalOf` to ask for a new code in place, or to show that the link is gone (HF-08).
 * Every 429 carries `Retry-After`, and so does the SMS cap's 503 (the time to the next day in India), which
 * the api-client hands the page as `retryAfterSeconds`; the other 503s carry none.
 */

/** The messages of the identity step's and the form's refusals, by the route that raises each and its status. */
export const HOTEL_FORM_ERRORS = {
  /** 404 (codes, verify): the link is unknown, expired, revoked, rejected or not admitted by the mode. */
  notActive: "This link is not active. Ask AMPM for a new one.",
  /**
   * 409 (codes; submit): the page showed an older privacy notice, or older words of a declaration (7.4,
   * 7.5), than the ones in force.
   */
  noticeStale: "The form was updated. Reload the page.",
  /** 400 on `botToken` (codes): the Turnstile pass is missing, used, or for another page or action. */
  botCheck: "Complete the bot check to continue",
  /** 401 (verify): a wrong, used, replaced, expired or out-of-tries code; the same for every case. */
  invalidCode: "That code didn't work or has expired. Check it, or ask for a new one.",
  /** 429 (codes): another code for this mobile within 30 seconds of the last. */
  tooSoon: "Please wait a few seconds before asking for another code.",
  /** 429 (codes): more than 5 codes in an hour, or 10 in a day, for this mobile. */
  mobileLimit: "Too many codes for this mobile. Please try again later.",
  /** 429 (codes): three codes for this mobile on this link were each tried 5 times within an hour. */
  mobileLocked: "Too many wrong codes for this mobile. Please try again in an hour.",
  /** 429 (codes): more than 60 code requests from this network in a day. */
  networkLimit: "Too many codes were asked for from this network today. Please try again later.",
  /** 429 (codes): more than 20 codes an hour, or 50 a day, on this link. */
  requestLimit: "Too many codes were asked for on this link. Please try again later.",
  /**
   * 503 (codes): the day's SMS budget across every request is spent (SMS mode only); `Retry-After` names the
   * time to the next day in India.
   */
  smsCapReached: "Codes can't be sent right now. Please try again later.",
  /**
   * 503 (codes): the limits cannot be counted, or the code's SMS cannot be queued, so no code is issued;
   * no `Retry-After`.
   */
  codesUnavailable: "Codes can't be sent right now. Please try again in a few minutes.",
  /** 409 (verify): a new person beyond the request's `maxPeople`; a returning person still signs in. */
  peopleFull:
    "This link already has as many people as it can take. Ask AMPM if someone should be removed.",
  /** 409 (verify): a new person after the merge, while the request shows its status only. */
  closedToNewPeople: "This request is complete, so no one new can join it.",
  /** 403 (verify): AMPM removed the person with this mobile from the request. */
  mobileRemoved: "AMPM removed this mobile number from the request. Ask AMPM if this is a mistake.",
  /**
   * 409 (PATCH me: the request shows its status only; a section's save: submitted, in review or showing
   * its status only); a section's details say who submitted and when (`hotelFormReadOnlyOf`).
   */
  readOnly: "This request is complete, so nothing can be changed.",
  /** 429 (PATCH me): more than 10 changes a minute in one session. */
  writeLimit: "Too many changes in a short time. Please wait a moment and try again.",
  /**
   * 503 (PATCH me, a section's save, a correction): a write window cannot be counted, so nothing is
   * changed uncounted; no `Retry-After`.
   */
  writesUnavailable: "Your changes can't be saved right now. Please try again in a few minutes.",
  /**
   * 409 (a section's save): a colleague saved the section after the version this save was based on; the
   * details carry their save (`hotelFormSectionConflictOf`), for Keep mine or Take theirs.
   */
  sectionConflict:
    "A colleague saved this section after you opened it. Choose which version to keep.",
  /** 400 on `answers` (a section's save): over the section's cap; the detail names it in KB. */
  sectionTooLarge: "This section is too long to save. Shorten the notes or remove some rows.",
  /** 400 on `noChanges` (a section's save): "No changes since last time" is for a refresh only. */
  noChangesOnOnboarding:
    "“No changes since last time” is only for updating a hotel AMPM already lists.",
  /** 400 (submit): what submit needs is missing; the details list every item (`hotelFormMissingItemsOf`). */
  submitIncomplete: "Some answers are still needed. Complete the items listed, then submit again.",
  /**
   * 409 (submit): the request was submitted already and this is not that submit again (AMPM moved it on,
   * or this one's declarations differ); the details say who submitted and when (`hotelFormReadOnlyOf`).
   */
  alreadySubmitted:
    "This form has already been submitted. You can still ask AMPM for a correction.",
  /** 409 (corrections): the request was never submitted, so there is nothing to correct yet. */
  notSubmitted: "Submit the form first. After that you can ask AMPM for a correction.",
  /** 429 (corrections): more than 5 corrections on this request within a day; `Retry-After` says when. */
  correctionLimit:
    "Too many corrections were sent on this request today. Please try again tomorrow.",
} as const;

/**
 * Why a form session was refused (a 401 on every session route): `no_session` (no token, or one that
 * names no session), `session_ended` (signed out, or ended by a newer session: a person holds 3 at most),
 * `session_expired` (2 hours idle or 12 in all), `link_changed` (AMPM reissued the link), `person_removed`
 * (AMPM removed the person), `not_active` (the request is no longer open to the form). The first three
 * ask for a new code in place; the last three end at HF-08.
 */
export const hotelFormSessionRefusal = z.enum([
  "no_session",
  "session_ended",
  "session_expired",
  "link_changed",
  "person_removed",
  "not_active",
]);
export type HotelFormSessionRefusal = z.infer<typeof hotelFormSessionRefusal>;

/** The message each reason's 401 carries. */
export const HOTEL_FORM_SESSION_REFUSAL_MESSAGES: Readonly<
  Record<HotelFormSessionRefusal, string>
> = {
  no_session: "Enter a new code to continue.",
  session_ended: "You were signed out. Enter a new code to continue.",
  session_expired: "Your session timed out. Enter a new code to continue.",
  link_changed: "AMPM replaced this link. Ask AMPM for the new one.",
  person_removed: "AMPM removed you from this request. Ask AMPM if this is a mistake.",
  not_active: HOTEL_FORM_ERRORS.notActive,
};

/** The `details` path a session's 401 names its reason under. */
export const HOTEL_FORM_REFUSAL_REASON_PATH = "reason";

/**
 * The 401 a session route refuses with (the API raises it; the envelope carries the reason).
 *
 * @example
 * throw hotelFormSessionError("session_expired");
 */
export function hotelFormSessionError(reason: HotelFormSessionRefusal): AppError {
  return new AppError("unauthenticated", HOTEL_FORM_SESSION_REFUSAL_MESSAGES[reason], [
    { path: HOTEL_FORM_REFUSAL_REASON_PATH, message: reason },
  ]);
}

/** What the page reads of an error: an `AppError`, as the api-client raises it, will do. */
interface RefusedCall {
  readonly code: string;
  readonly details?: readonly ErrorDetail[] | undefined;
}

/**
 * The reason a session route refused with, or null when the error is not a session refusal.
 *
 * @example
 * const reason = hotelFormSessionRefusalOf(error);
 * if (reason === "session_expired") askForNewCode();
 */
export function hotelFormSessionRefusalOf(error: RefusedCall): HotelFormSessionRefusal | null {
  if (error.code !== "unauthenticated") return null;
  const detail = error.details?.find((entry) => entry.path === HOTEL_FORM_REFUSAL_REASON_PATH);
  const reason = hotelFormSessionRefusal.safeParse(detail?.message);
  return reason.success ? reason.data : null;
}
