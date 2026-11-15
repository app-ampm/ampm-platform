import {
  clientAmount,
  formatDay,
  type PaymentFinanceView,
  type SubscriptionReportRow,
  type SubscriptionStatus,
} from "@ampm/core";
import { formatMoney } from "@ampm/ui";

import { subscriptionStatusLabel } from "../accounts/accounts.format";
import { paymentMethodLabel, paymentStatusLabel } from "../accounts/payments.format";

/** The report's three views: Finance's queue first, then what is running, then everything. */
export type FinanceTab = "awaiting" | "active" | "all";

export const FINANCE_TABS: readonly { readonly value: FinanceTab; readonly label: string }[] = [
  { value: "awaiting", label: "Awaiting payment" },
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
];

const TAB_STATUS: Record<FinanceTab, SubscriptionStatus | undefined> = {
  awaiting: "pending_payment",
  active: "active",
  all: undefined,
};

/** The report filter behind a tab: awaiting payment, active, or no status at all. */
export function financeTabStatus(tab: FinanceTab): SubscriptionStatus | undefined {
  return TAB_STATUS[tab];
}

export function isFinanceTab(value: string): value is FinanceTab {
  return FINANCE_TABS.some((tab) => tab.value === value);
}

/** A day set as data ("15 NOV 2026"), for a table cell or a ledger line. */
export function financeDay(iso: string): string {
  return formatDay(iso, { style: "data" });
}

/** The last payment towards a subscription: "Gateway · Initiated", or that none was made. */
export function lastAttemptLabel(row: SubscriptionReportRow): string {
  if (!row.lastPayment) return "No payment yet";
  const { method, status } = row.lastPayment;
  return `${paymentMethodLabel(method)} · ${paymentStatusLabel(status)}`;
}

/** A screen-reader summary of a report row: whose subscription, which plan, since when. */
export function reportRowSummary(row: SubscriptionReportRow): string {
  const since =
    row.status === "pending_payment"
      ? `awaiting payment since ${financeDay(row.createdAt)}`
      : subscriptionStatusLabel(row.status).toLowerCase();
  return `${row.accountName}, ${row.planName}, ${since}`;
}

/** Whose payment the record sheet takes: "Nisha & Arjun · Hotel Discovery · ₹50,000". */
export function recordingSubject(row: SubscriptionReportRow): string {
  return `${row.accountName} · ${row.planName} · ${formatMoney(clientAmount(row.amount.minor)).text}`;
}

/** A payment's pill: the day it was paid, or its state while it is not ("Initiated"). */
export function paymentPillLabel(payment: PaymentFinanceView): string {
  if (payment.status === "succeeded" && payment.paidAt) {
    return `Paid ${formatDay(payment.paidAt)}`;
  }
  return paymentStatusLabel(payment.status);
}

const EMPTY: Record<FinanceTab, { readonly title: string; readonly description: string }> = {
  awaiting: {
    title: "Nothing awaiting payment",
    description: "A subscription appears here once Sales starts it, until its payment lands.",
  },
  active: {
    title: "No active subscriptions",
    description: "Subscriptions show here once their payment has been received.",
  },
  all: {
    title: "No subscriptions yet",
    description: "Subscriptions appear here once Sales starts one for a client.",
  },
};

/** What an empty tab says. */
export function financeEmptyCopy(tab: FinanceTab): {
  readonly title: string;
  readonly description: string;
} {
  return EMPTY[tab];
}
