import {
  formatAmount,
  formatDay,
  internalAmount,
  type Money,
  type PaymentDirection,
  type PaymentMethod,
  type PaymentPurpose,
  type PaymentStatus,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

import { paymentMethodLabel as manualPaymentMethodLabel } from "./accounts.format";

/* Presentation for the finance payment ledger (RESTRICTED-FINANCE; the account detail, FA/SA). */

const DIRECTION_LABEL: Record<PaymentDirection, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
};
const DIRECTION_TONE: Record<PaymentDirection, StatusTone> = {
  inbound: "success",
  outbound: "info",
};
export function paymentDirectionLabel(direction: PaymentDirection): string {
  return DIRECTION_LABEL[direction];
}
export function paymentDirectionTone(direction: PaymentDirection): StatusTone {
  return DIRECTION_TONE[direction];
}

const PURPOSE_LABEL: Record<PaymentPurpose, string> = {
  subscription: "Subscription",
  service_fee: "Service fee",
  milestone: "Milestone",
  vendor_payment: "Vendor payment",
  hotel_payment: "Hotel payment",
  refund: "Refund",
};
export function paymentPurposeLabel(purpose: PaymentPurpose): string {
  return PURPOSE_LABEL[purpose];
}

/** The full payment-method label: the manual methods (reused) plus the online gateway. */
export function paymentMethodLabel(method: PaymentMethod): string {
  return method === "gateway" ? "Gateway" : manualPaymentMethodLabel(method);
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  initiated: "Initiated",
  pending: "Pending",
  succeeded: "Succeeded",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};
const STATUS_TONE: Record<PaymentStatus, StatusTone> = {
  initiated: "neutral",
  pending: "warning",
  succeeded: "success",
  failed: "danger",
  refunded: "neutral",
  cancelled: "neutral",
};
export function paymentStatusLabel(status: PaymentStatus): string {
  return STATUS_LABEL[status];
}
export function paymentStatusTone(status: PaymentStatus): StatusTone {
  return STATUS_TONE[status];
}

/** The finance amount as a display string — an INTERNAL amount, never a client-facing `MoneyText`. */
export function paymentAmountLabel(amount: Money): string {
  return formatAmount(internalAmount(amount.minor, amount.currency));
}

/** When the payment settled, as data ("8 NOV 2026"); "Pending" when it has no paid date yet. The word
 *  is direction-neutral — it reads correctly for an inbound receipt and an outbound settlement alike. */
export function paymentPaidLabel(paidAt: string | null): string {
  return paidAt ? formatDay(paidAt, { style: "data" }) : "Pending";
}
