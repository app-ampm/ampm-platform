import type { ZodError } from "zod";

import type { FormFields } from "./enquiry-fields";

/** Turn the PUB-06 form's string fields into the enquiry request shape; empty strings become undefined. */
export function toPayload(fields: FormFields): Record<string, unknown> {
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
    // Development bot-check placeholder; the real Cloudflare Turnstile token replaces it at go-live (R15).
    botToken: "dev-bot-check",
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
