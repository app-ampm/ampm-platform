import type { SubscriptionReportRow } from "@ampm/core";

import { subscriptionStatusLabel } from "../accounts/accounts.format";
import { paymentMethodLabel, paymentStatusLabel } from "../accounts/payments.format";
import { csvText } from "../admin/csv";

/*
 * The subscription report as a CSV snapshot (a header row, one row per subscription). Times are the raw
 * ISO values, precise for a record; the amount is in rupees as a plain number a spreadsheet can sum;
 * statuses and methods are their labels. Every field is the report row's own (CLIENT-class). No fetching.
 */

const HEADERS = [
  "Account",
  "Plan",
  "Status",
  "Amount (INR)",
  "Created (UTC)",
  "Started (UTC)",
  "Ends (UTC)",
  "Last payment method",
  "Last payment status",
  "Paid (UTC)",
  "Subscription ID",
  "Account ID",
] as const;

/** Paise as rupees with two decimals ("50000.00"), in integer arithmetic so nothing rounds. */
function rupees(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const paise = Math.abs(minor);
  return `${sign}${Math.trunc(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

function csvRow(row: SubscriptionReportRow): readonly string[] {
  return [
    row.accountName,
    row.planName,
    subscriptionStatusLabel(row.status),
    rupees(row.amount.minor),
    row.createdAt,
    row.startsAt ?? "",
    row.endsAt ?? "",
    row.lastPayment ? paymentMethodLabel(row.lastPayment.method) : "",
    row.lastPayment ? paymentStatusLabel(row.lastPayment.status) : "",
    row.lastPayment?.paidAt ?? "",
    row.subscriptionId,
    row.accountId,
  ];
}

/** The subscriptions as CSV text (CRLF line endings, a header row), ready to download. */
export function subscriptionReportCsv(rows: readonly SubscriptionReportRow[]): string {
  return csvText([HEADERS, ...rows.map(csvRow)]);
}
