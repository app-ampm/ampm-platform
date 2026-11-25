import {
  HOTEL_FORM_ERRORS,
  errors,
  hotelFormSessionRefusalOf,
  isAppError,
  type AppError,
  type HotelFormSessionRefusal,
} from "@ampm/core";

import { HOTEL_FORM_COPY as COPY } from "./hotel-form-copy";

/*
 * What the page does when a route of the form refuses (D-189 §3 to §5). The API words every refusal of
 * the form for the person (HOTEL_FORM_ERRORS and the session messages), so the page shows those words as
 * they come; only a failure with nothing to say (a lost connection, a crash, a limiter's bare "Too many
 * requests") is worded by the page, never shown raw.
 */

/** The page's answer to a refusal. */
export type Refusal =
  /** HF-08: the link is not active, was replaced, or the person was removed; null keeps HF-08's own words. */
  | { readonly kind: "gone"; readonly message: string | null }
  /** The session ended, timed out or is unknown: ask for a new code in place, keeping what was typed. */
  | { readonly kind: "new_code"; readonly message: string }
  /** Wait, then try again: a 429 or a 503 that said how long (Retry-After). */
  | { readonly kind: "wait"; readonly message: string; readonly seconds: number }
  /** The privacy notice changed under the page: reload it. */
  | { readonly kind: "reload"; readonly message: string }
  /** One field was refused (`botToken`, `mobile`, `oneTimeCode`…): its message goes on that field. */
  | { readonly kind: "field"; readonly field: string; readonly message: string }
  /** Anything else, shown as a notice. */
  | { readonly kind: "message"; readonly message: string };

/** The field a refused code belongs to (verify's body names it so). */
export const CODE_FIELD = "oneTimeCode";

/** A refusal of the session itself: a new code in place, or HF-08. */
export type SessionRefusal = Extract<Refusal, { readonly kind: "new_code" | "gone" }>;

/** Whether a refusal is the session's own (it ended, or the link is gone), which the flow takes over. */
export function asksForSession(refusal: Refusal): refusal is SessionRefusal {
  return refusal.kind === "new_code" || refusal.kind === "gone";
}

/**
 * How saving your own details ended: saved; refused in the API's words, with when Save may be pressed
 * again when the API said (a Retry-After); or the session was refused, which the flow takes over.
 */
export type SaveOutcome =
  | { readonly kind: "saved" }
  | { readonly kind: "refused"; readonly message: string; readonly retryAt: number | null }
  | { readonly kind: "session" };

/**
 * A refused save as the edit shows it: a wait keeps its end, on this device's clock, for Save's countdown.
 *
 * @example
 * saveOutcomeOf({ kind: "wait", message, seconds: 30 }, Date.now()); // { kind: "refused", message, retryAt }
 */
export function saveOutcomeOf(refusal: Refusal, now: number): SaveOutcome {
  if (asksForSession(refusal)) return { kind: "session" };
  const retryAt = refusal.kind === "wait" ? now + refusal.seconds * 1000 : null;
  return { kind: "refused", message: refusal.message, retryAt };
}

/** The session refusals that end at HF-08; the others ask for a new code. */
const GONE_REASONS: ReadonlySet<HotelFormSessionRefusal> = new Set([
  "link_changed",
  "person_removed",
  "not_active",
]);

/** The words core's error helpers fall back to when the API has nothing more specific to say. */
const BARE_MESSAGES: ReadonlySet<string> = new Set([
  errors.rateLimited().message,
  errors.unavailable().message,
  errors.validation([]).message,
  errors.internal().message,
]);

/** The API's words, or the page's when the API's are bare. */
function wordsOf(error: AppError): string {
  if (!BARE_MESSAGES.has(error.message)) return error.message;
  return error.code === "rate_limited" ? COPY.errors.tooMany : COPY.errors.unexpected;
}

/** A refusal with a reason the form's routes alone give: the session's, or the link's. */
function linkRefusalOf(error: AppError): Refusal | null {
  const reason = hotelFormSessionRefusalOf(error);
  if (reason !== null)
    return { kind: GONE_REASONS.has(reason) ? "gone" : "new_code", message: error.message };
  if (error.code === "not_found")
    return {
      kind: "gone",
      message: error.message === HOTEL_FORM_ERRORS.notActive ? error.message : null,
    };
  if (error.code === "conflict" && error.message === HOTEL_FORM_ERRORS.noticeStale)
    return { kind: "reload", message: error.message };
  // A 401 that names no session reason comes from verify alone: the code itself was refused.
  if (error.code === "unauthenticated")
    return { kind: "field", field: CODE_FIELD, message: error.message };
  return null;
}

/**
 * The page's answer to a failed call of the form's routes.
 *
 * @example
 * const refusal = refusalOf(error);
 * if (refusal.kind === "new_code") askForNewCode(refusal.message);
 */
export function refusalOf(error: unknown): Refusal {
  if (!isAppError(error)) return { kind: "message", message: COPY.errors.unexpected };
  const linkRefusal = linkRefusalOf(error);
  if (linkRefusal !== null) return linkRefusal;
  if (error.code === "network_error") return { kind: "message", message: COPY.errors.network };
  if (error.code === "internal") return { kind: "message", message: COPY.errors.unexpected };
  const isWait = error.code === "rate_limited" || error.code === "unavailable";
  if (isWait && error.retryAfterSeconds !== undefined)
    return { kind: "wait", message: wordsOf(error), seconds: error.retryAfterSeconds };
  const field = error.details?.find((detail) => detail.path !== undefined && detail.path !== "");
  if (error.code === "validation_failed" && field?.path !== undefined)
    return { kind: "field", field: field.path, message: field.message };
  return { kind: "message", message: wordsOf(error) };
}
