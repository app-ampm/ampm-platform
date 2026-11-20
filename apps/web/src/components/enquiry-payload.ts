import { isAppError, leadEnquiryRequest, type LeadEnquiryRequest } from "@ampm/core";
import type { ZodError } from "zod";

import type { FormFields, SendFailure } from "./enquiry-fields";

/**
 * Turn the PUB-06 form's string fields into the enquiry request shape; empty strings become undefined.
 * `botToken` is the bot check's Cloudflare Turnstile token, which the API verifies with Cloudflare.
 */
export function toPayload(fields: FormFields, botToken: string | null): Record<string, unknown> {
  const text = (value: string) => (value.trim() === "" ? undefined : value.trim());
  return {
    name: fields.name,
    email: text(fields.email),
    phone: text(fields.phone),
    contactPreference: text(fields.contactPreference),
    tentativeDateFrom: text(fields.tentativeDateFrom),
    tentativeDateTo: text(fields.tentativeDateTo),
    destinationText: text(fields.destinationText),
    guestEstimate: fields.guestEstimate.trim() === "" ? undefined : Number(fields.guestEstimate),
    requirements: text(fields.requirements),
    requestedDemo: fields.requestedDemo,
    consentMarketing: fields.consentMarketing,
    botToken: botToken ?? undefined,
  };
}

/** Map a Zod validation failure to one message per field for the form. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** What pressing Send does with the form as it stands. */
export type SubmitStep =
  | { readonly kind: "invalid"; readonly errors: Record<string, string> }
  | { readonly kind: "wait" }
  | { readonly kind: "send"; readonly request: LeadEnquiryRequest };

/**
 * Pressing Send: the fields are checked with the shared schema first, so their errors show whatever
 * the bot check is doing; without a token the form waits (Send is disabled then, so only an Enter in a
 * field lands here), and otherwise the request carries the token.
 */
export function submitStep(fields: FormFields, botToken: string | null): SubmitStep {
  const parsed = leadEnquiryRequest.safeParse(toPayload(fields, botToken));
  if (!parsed.success) return { kind: "invalid", errors: fieldErrors(parsed.error) };
  return botToken === null ? { kind: "wait" } : { kind: "send", request: parsed.data };
}

/**
 * Why a send failed, for the notice above Send; undefined when it did not. The API names `botToken`
 * when Cloudflare refused the token (spent, expired or forged).
 */
export function sendFailureOf(error: unknown): SendFailure | undefined {
  if (!error) return undefined;
  if (!isAppError(error)) return "other";
  if (error.code === "rate_limited") return "rate_limited";
  const isBotCheck =
    error.code === "validation_failed" &&
    (error.details ?? []).some((detail) => detail.path === "botToken");
  return isBotCheck ? "bot_check" : "other";
}
