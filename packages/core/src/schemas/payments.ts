import { z } from "zod";

import { isoDateTime, money, uuid } from "./common.js";

/*
 * Contracts for payments (Module B CRM; feature 8.3 handles inbound subscription payments). Visibility
 * is by row, not by field: an inbound, client-visible payment is the subscriber's own receipt (CLIENT);
 * every other row is RESTRICTED-FINANCE. Per security.md that is two response models, never one model
 * with a hidden field — `paymentClientView` (strict, client) and `paymentFinanceView` (FA/SA).
 */

export const paymentDirection = z.enum(["inbound", "outbound"]);
export type PaymentDirection = z.infer<typeof paymentDirection>;

export const paymentPurpose = z.enum([
  "subscription",
  "service_fee",
  "milestone",
  "vendor_payment",
  "hotel_payment",
  "refund",
]);
export type PaymentPurpose = z.infer<typeof paymentPurpose>;

export const paymentMethod = z.enum(["gateway", "bank_transfer", "upi", "cheque", "cash"]);
export type PaymentMethod = z.infer<typeof paymentMethod>;

export const paymentStatus = z.enum([
  "initiated",
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "cancelled",
]);
export type PaymentStatus = z.infer<typeof paymentStatus>;

/**
 * A payment as the account's own client sees its receipt (CP-11 portal). Strict and narrow — amount,
 * what it was for, how and when paid — and nothing finance-internal (no direction, provider reference,
 * recorder or counterparty), so no RESTRICTED-FINANCE field can reach a client (AC-12.3).
 */
export const paymentClientView = z
  .object({
    id: uuid,
    amount: money,
    purpose: paymentPurpose,
    method: paymentMethod,
    status: paymentStatus,
    paidAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
  })
  .strict();
export type PaymentClientView = z.infer<typeof paymentClientView>;

/** A payment as Finance sees it (RESTRICTED-FINANCE, FA/SA). Never serialised to a client. */
export const paymentFinanceView = z.object({
  id: uuid,
  accountId: uuid,
  direction: paymentDirection,
  purpose: paymentPurpose,
  amount: money,
  method: paymentMethod,
  status: paymentStatus,
  provider: z.string().nullable(),
  providerRef: z.string().nullable(),
  relatedType: z.string().nullable(),
  relatedId: uuid.nullable(),
  paidAt: isoDateTime.nullable(),
  recordedBy: uuid.nullable(),
  createdAt: isoDateTime,
});
export type PaymentFinanceView = z.infer<typeof paymentFinanceView>;

/**
 * Record a manual bank transfer against a pending subscription (TW-14, Finance). The amount is taken
 * from the plan, not the request, so it cannot disagree with the price; Finance supplies the bank
 * reference and, optionally, when it was received. Runs the same activation step as the webhook.
 */
export const manualPaymentRequest = z.object({
  reference: z.string().trim().min(1).max(255),
  method: z.enum(["bank_transfer", "upi", "cheque", "cash"]).default("bank_transfer"),
  paidAt: isoDateTime.optional(),
});
export type ManualPaymentRequest = z.infer<typeof manualPaymentRequest>;
