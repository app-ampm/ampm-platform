import { isIsoDate, isoDateTimeFromDate, type ManualPaymentRequest } from "@ampm/core";

import type { ManualPaymentMethod } from "./accounts.format";

/*
 * Pure form logic for recording a manual payment (TW-14, Finance). The amount is NOT entered — the server
 * takes it from the plan so it can never disagree with the price. Finance supplies the bank reference, the
 * method, and optionally the date it was received (typed as YYYY-MM-DD; sent as a midnight-UTC datetime).
 */

export interface PaymentDraft {
  readonly reference: string;
  readonly method: ManualPaymentMethod;
  readonly paidAt: string;
}

export function emptyPaymentDraft(): PaymentDraft {
  return { reference: "", method: "bank_transfer", paidAt: "" };
}

export type PaymentErrors = {
  readonly reference: string | undefined;
  readonly paidAt: string | undefined;
};

export function validatePayment(draft: PaymentDraft): PaymentErrors {
  const paidAt = draft.paidAt.trim();
  return {
    reference: draft.reference.trim() === "" ? "Enter the payment reference" : undefined,
    paidAt: paidAt !== "" && !isIsoDate(paidAt) ? "Enter the date as YYYY-MM-DD" : undefined,
  };
}

export function buildPaymentBody(draft: PaymentDraft): ManualPaymentRequest {
  const paidAt = draft.paidAt.trim();
  return {
    reference: draft.reference.trim(),
    method: draft.method,
    ...(paidAt === "" ? {} : { paidAt: isoDateTimeFromDate(paidAt) }),
  };
}

export function hasPaymentErrors(errors: PaymentErrors): boolean {
  return errors.reference !== undefined || errors.paidAt !== undefined;
}
