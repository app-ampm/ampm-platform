import {
  formatDay,
  type ClientAccountStatus,
  type ManualPaymentRequest,
  type SubscriptionStatus,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/** The payment methods Finance can record a manual transfer with (the manual subset, never "gateway"). */
export type ManualPaymentMethod = ManualPaymentRequest["method"];

const PAYMENT_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
};
export const PAYMENT_METHODS: readonly ManualPaymentMethod[] = [
  "bank_transfer",
  "upi",
  "cheque",
  "cash",
];
export function paymentMethodLabel(method: ManualPaymentMethod): string {
  return PAYMENT_METHOD_LABEL[method];
}

/* Presentation helpers for the staff client-accounts workspace (Module B, feature 8.2/8.3). */

const ACCOUNT_STATUS_LABEL: Record<ClientAccountStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  suspended: "Suspended",
  closed: "Closed",
};
const ACCOUNT_STATUS_TONE: Record<ClientAccountStatus, StatusTone> = {
  prospect: "neutral",
  active: "success",
  suspended: "warning",
  closed: "neutral",
};

export function accountStatusLabel(status: ClientAccountStatus): string {
  return ACCOUNT_STATUS_LABEL[status];
}
export function accountStatusTone(status: ClientAccountStatus): StatusTone {
  return ACCOUNT_STATUS_TONE[status];
}

const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  pending_payment: "Pending payment",
  active: "Active",
  expiring: "Expiring",
  expired: "Expired",
  suspended: "Suspended",
  cancelled: "Cancelled",
};
const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, StatusTone> = {
  trial: "neutral",
  pending_payment: "warning",
  active: "success",
  expiring: "warning",
  expired: "neutral",
  suspended: "warning",
  cancelled: "neutral",
};

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  return SUBSCRIPTION_STATUS_LABEL[status];
}
export function subscriptionStatusTone(status: SubscriptionStatus): StatusTone {
  return SUBSCRIPTION_STATUS_TONE[status];
}

/** The account's creation day, set as data ("3 NOV 2026"), for a list row's meta line. */
export function accountCreatedLabel(createdAt: string): string {
  return `Added ${accountDay(createdAt)}`;
}

/** A day set as data ("3 NOV 2026"), for a table cell or a detail row. */
export function accountDay(iso: string): string {
  return formatDay(iso, { style: "data" });
}

/** A screen-reader summary of one account row. */
export function accountRowSummary(name: string, status: ClientAccountStatus): string {
  return `${name}, ${accountStatusLabel(status).toLowerCase()}`;
}

/** A demo account (sales demos and tests) reads apart from a paying client's. */
export function accountTypeLabel(isDemo: boolean): string {
  return isDemo ? "Demo account" : "Client account";
}

/**
 * The record header's facts line (T3's meta line): the kind of account, the couple and when it was
 * added: "Client account · Priya & Arjun · Added 1 NOV 2026".
 */
export function accountFactsLine(account: {
  readonly isDemo: boolean;
  readonly coupleNames: string | null;
  readonly createdAt: string;
}): string {
  return [
    accountTypeLabel(account.isDemo),
    account.coupleNames,
    accountCreatedLabel(account.createdAt),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
