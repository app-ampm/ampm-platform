import {
  hotelFormCorrectionRequest,
  hotelFormStateOf,
  isAppError,
  type HotelFormCorrectionRequest,
  type HotelFormDraftRequest,
  type HotelFormRequestStatus,
} from "@ampm/core";

import { momentOf } from "../hotel-form-time";
import { asksForSession, refusalOf } from "../refusal";
import { STATUS_COPY as COPY } from "./status-copy";

/*
 * HF-07's rules (D-190 §5; plan §9.3), pure so they are tested without a page: who submitted and when,
 * what the page offers in each state, a correction's checks before it is sent, and the page's answer to a
 * refused correction or withdrawal.
 */

/**
 * Who submitted the request and when, in words: the time alone for a submitter who withdrew their
 * consent (never named), null before a submit.
 *
 * @example
 * submittedLineOf(draft.request); // "Submitted by Ravi Kumar on 26 Nov 2026 at 10:42."
 */
export function submittedLineOf(request: HotelFormDraftRequest): string | null {
  if (request.submittedAt === null) return null;
  const moment = momentOf(request.submittedAt);
  return request.submittedBy === null
    ? COPY.submittedAt(moment)
    : COPY.submittedBy(request.submittedBy, moment);
}

/**
 * Whether the request was ever submitted: withdrawing consent and asking for removal are offered from
 * then on (the privacy notice: "After you submit, the status page lets you…").
 */
export function hasBeenSubmitted(request: HotelFormDraftRequest): boolean {
  return request.submittedAt !== null || hotelFormStateOf(request.status) !== "ready";
}

/**
 * Whether a correction is what the person needs: the answers can't be edited (submitted, in review or
 * complete). While AMPM's changes are wanted, the person edits the answers instead.
 */
export function takesCorrections(status: HotelFormRequestStatus): boolean {
  return hotelFormStateOf(status) !== "ready";
}

/** What pressing Send does with a correction: fix the message, wait for the check, or send. */
export type CorrectionCheck =
  | { readonly kind: "fix"; readonly error: string }
  | { readonly kind: "bot_check" }
  | { readonly kind: "send"; readonly correction: HotelFormCorrectionRequest };

/**
 * A correction's checks before it is sent, in core's words: some words, at most 2,000 characters, then a
 * passed bot check.
 *
 * @example
 * correctionCheckOf(message, botCheck.token); // { kind: "send", correction: { message, botToken } }
 */
export function correctionCheckOf(message: string, botToken: string | null): CorrectionCheck {
  const parsed = hotelFormCorrectionRequest.safeParse({ message });
  if (!parsed.success) return { kind: "fix", error: parsed.error.issues[0]?.message ?? "" };
  if (botToken === null) return { kind: "bot_check" };
  return { kind: "send", correction: { message: parsed.data.message, botToken } };
}

/** The page's answer to a refused correction or withdrawal. */
export type PressRefusal =
  /** The session's own refusal: the flow asks for a new code in place. */
  | { readonly kind: "session" }
  /** 400 on `botToken`: the pass was refused; the check runs again. */
  | { readonly kind: "bot"; readonly message: string }
  /** 429 (the day's corrections, a network's writes): when the person may try again. */
  | { readonly kind: "wait"; readonly message: string; readonly retryAt: number }
  | { readonly kind: "message"; readonly message: string };

/**
 * The page's answer to a refused correction or withdrawal, in the API's words (409 notSubmitted, 429
 * correctionLimit, 503 writesUnavailable…), the page's own only when the API had none.
 *
 * @example
 * pressRefusalOf(error); // { kind: "wait", message: HOTEL_FORM_ERRORS.correctionLimit, retryAt }
 */
export function pressRefusalOf(error: unknown): PressRefusal {
  const isBot =
    isAppError(error) &&
    error.code === "validation_failed" &&
    (error.details ?? []).some((detail) => detail.path === "botToken");
  if (isBot) return { kind: "bot", message: error.message };
  const refusal = refusalOf(error);
  if (asksForSession(refusal)) return { kind: "session" };
  if (refusal.kind === "wait")
    return { kind: "wait", message: refusal.message, retryAt: Date.now() + refusal.seconds * 1000 };
  return { kind: "message", message: refusal.message };
}
