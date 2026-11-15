import type { SubscriptionReportRow } from "@ampm/core";

import { toClientMoney } from "./money.js";
import type { SubscriptionReportDbRow } from "./subscription-report.repository.js";

/**
 * A subscription as the §5.16 report shows it to SA, SM and FA (D-127). Built field by field from the
 * report's own row, so nothing outside the strict `subscriptionReportRow` contract can reach Sales. The
 * amount is the plan's price, through the one numeric→paise serialiser (money.ts).
 */
export function toSubscriptionReportRow(row: SubscriptionReportDbRow): SubscriptionReportRow {
  return {
    subscriptionId: row.id,
    accountId: row.accountId,
    accountName: row.accountName,
    planId: row.planId,
    planName: row.planName,
    amount: toClientMoney(row.priceAmount),
    status: row.status,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    lastPayment: row.lastPayment
      ? {
          method: row.lastPayment.method,
          status: row.lastPayment.status,
          paidAt: row.lastPayment.paidAt ? row.lastPayment.paidAt.toISOString() : null,
          createdAt: row.lastPayment.createdAt.toISOString(),
        }
      : null,
  };
}
