"use client";

import { useState, type FormEvent } from "react";
import { ApiProvider, useSubmitEnquiry } from "@ampm/api-client";
import { isAppError, leadEnquiryRequest } from "@ampm/core";

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
import { fieldErrors, toPayload } from "./enquiry-payload";

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
