import {
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_TOO_LARGE_PATH,
  hotelFormReadOnlyOf,
  hotelFormSectionConflictOf,
  isAppError,
  type AppError,
  type HotelFormSectionKey,
} from "@ampm/core";

import { asksForSession, refusalOf } from "../refusal";
import type { SaveRefusal } from "./section-autosave";

/*
 * A refused section save (PUT /hotel-form/draft/sections/:key, D-190 §3) as the page treats it. The 409s'
 * details say what happened: a colleague's newer save of this section, or who submitted the request (the
 * readOnly message says "complete", so the page words the locked case from these details). A session's
 * refusal waits for a new code, which the flow asks for in place; a 429 waits out its Retry-After. Every
 * other refusal is shown in the API's words, or the page's when the API had none.
 */

/** The message of a 400 sectionTooLarge with the cap it names ("Keep this section under 96 KB"). */
function tooLargeMessage(error: AppError): string {
  const cap = error.details?.find((detail) => detail.path === HOTEL_FORM_TOO_LARGE_PATH);
  return cap
    ? `${HOTEL_FORM_ERRORS.sectionTooLarge} ${cap.message}`
    : HOTEL_FORM_ERRORS.sectionTooLarge;
}

/**
 * How the page goes on after a section's save was refused.
 *
 * @example
 * const refusal = saveRefusalOf(error, "rooms"); // { kind: "conflict", theirs } → Keep mine or Take theirs
 */
export function saveRefusalOf<K extends HotelFormSectionKey>(
  error: unknown,
  section: K,
): SaveRefusal<K> {
  if (isAppError(error)) {
    const theirs = hotelFormSectionConflictOf(error, section);
    if (theirs !== null) return { kind: "conflict", theirs };
    const readOnly = hotelFormReadOnlyOf(error);
    if (readOnly !== null || error.message === HOTEL_FORM_ERRORS.readOnly)
      return { kind: "locked", readOnly };
    if (error.message === HOTEL_FORM_ERRORS.sectionTooLarge)
      return { kind: "failed", message: tooLargeMessage(error) };
  }
  const refusal = refusalOf(error);
  if (asksForSession(refusal)) return { kind: "session" };
  if (refusal.kind === "wait")
    return { kind: "wait", message: refusal.message, seconds: refusal.seconds };
  return { kind: "failed", message: refusal.message };
}
