"use client";

import { useState, type FormEvent } from "react";
import { ApiProvider, useSubmitEnquiry } from "@ampm/api-client";
import { isAppError, leadEnquiryRequest } from "@ampm/core";
import type { ZodError } from "zod";

import { env } from "@/env";
import {
  ConsentFields,
  EMPTY,
  FormActions,
  IdentityFields,
  ThankYou,
  WeddingFields,
  type FieldGroupProps,
  type FormFields,
} from "./enquiry-fields";

/*
 * PUB-06 — the public enquiry and demo-request form (Module B CRM, feature 8.1). No account is created
 * here (WHY §4); the form posts through the typed client to the public /crm/enquiries endpoint, which
 * captures consent, flags a duplicate for Sales and notifies them. Validation reuses the one Zod schema
 * from @ampm/core (contract-first).
 */

/** The public enquiry form, wired to the API through a scoped provider. */
export function ContactForm() {
  return (
    <ApiProvider baseUrl={env.NEXT_PUBLIC_API_URL}>
      <EnquiryForm />
    </ApiProvider>
  );
}

function EnquiryForm() {
  const [fields, setFields] = useState<FormFields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState<string | null>(null);
  const submit = useSubmitEnquiry();

  const onText: FieldGroupProps["onText"] = (key) => (event) =>
    setFields((prev) => ({ ...prev, [key]: event.target.value }));
  const onCheck: FieldGroupProps["onCheck"] = (key) => (event) =>
    setFields((prev) => ({ ...prev, [key]: event.target.checked }));

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = leadEnquiryRequest.safeParse(toPayload(fields));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    submit.mutate(parsed.data, { onSuccess: (result) => setFirstName(result.firstName) });
  }

  if (firstName) return <ThankYou firstName={firstName} />;
  const groupProps: FieldGroupProps = { fields, errors, onText, onCheck };
  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-subtle bg-surface-elevated p-6 shadow-sm"
    >
      <IdentityFields {...groupProps} />
      <WeddingFields {...groupProps} />
      <ConsentFields {...groupProps} />
      <FormActions
        isPending={submit.isPending}
        isError={submit.isError}
        isRateLimited={isAppError(submit.error) && submit.error.code === "rate_limited"}
      />
    </form>
  );
}

/** Turn the form's string fields into the enquiry request shape; empty strings become undefined. */
function toPayload(fields: FormFields): Record<string, unknown> {
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

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
