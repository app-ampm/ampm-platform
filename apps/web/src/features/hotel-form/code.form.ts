import { hotelFormVerifyRequest, type HotelFormVerifyRequest } from "@ampm/core";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";

/*
 * HF-03's helpers: what pressing Continue does with the code, and when "Send a new code" may be pressed
 * again (D-189 §3: a 30-second pause per mobile, answered as `resendAfter`).
 */

/** What pressing Continue does with the code as it stands. */
export type CodeStep =
  | { readonly kind: "invalid"; readonly error: string }
  | { readonly kind: "send"; readonly request: HotelFormVerifyRequest };

/**
 * The code for the challenge on screen, checked with core's schema ("Enter the 6-digit code").
 *
 * @example
 * codeStep("482917", link, issued.challengeId); // { kind: "send", request: { … } }
 */
export function codeStep(code: string, link: string, challengeId: string): CodeStep {
  const parsed = hotelFormVerifyRequest.safeParse({ token: link, challengeId, oneTimeCode: code });
  if (parsed.success) return { kind: "send", request: parsed.data };
  const issue = parsed.error.issues.find((entry) => entry.path[0] === "oneTimeCode");
  return { kind: "invalid", error: issue?.message ?? HOTEL_FORM_COPY.errors.unexpected };
}

/** The longest resend wait the page counts: the API's pause is 30 seconds. */
export const RESEND_WAIT_CAP_MS = 60_000;

/**
 * When, on this device's clock, another code may be asked for: the API's `resendAfter`, counted from
 * now, and never more than a minute away, so a device clock far behind the API's cannot hold the person
 * for hours (a resend pressed too early is answered with a Retry-After, which the page counts instead).
 *
 * @example
 * resendDeadline(issued, Date.now()); // Date.now() + 30_000
 */
export function resendDeadline(issued: { readonly resendAfter: string }, now: number): number {
  const wait = Date.parse(issued.resendAfter) - now;
  if (Number.isNaN(wait)) return now;
  return now + Math.min(Math.max(wait, 0), RESEND_WAIT_CAP_MS);
}

/**
 * "+91 ••••• •1234" as a screen reader should say it: "your mobile number ending in 1234".
 *
 * @example
 * spokenMobile(issued.maskedMobile); // "your mobile number ending in 1234"
 */
export function spokenMobile(masked: string): string | undefined {
  const last = /(\d+)\s*$/.exec(masked)?.[1];
  return last ? HOTEL_FORM_COPY.code.spokenMobile(last) : undefined;
}
