import {
  subscriptionReportPage,
  type SubscriptionReportRow,
  type SubscriptionStatus,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList } from "./use-cursor-list";

/*
 * The "Subscription status and payment history" report (permission-matrix §5.16; SA, SM, FA). Finance
 * lists the subscriptions awaiting a manual payment through it (D-127). Pass `enabled: false` when the
 * signed-in role lacks the report key, so a refused principal never drives a forever-failing retry.
 */

export const SUBSCRIPTION_REPORT_QUERY_KEY = ["crm", "reports", "subscriptions"] as const;

export interface SubscriptionReportFilter {
  readonly status?: SubscriptionStatus | undefined;
}

function reportPath(filter: SubscriptionReportFilter, cursor: string | undefined): string {
  const params = new URLSearchParams({ limit: "50" });
  if (filter.status) params.set("status", filter.status);
  if (cursor) params.set("cursor", cursor);
  return `/crm/reports/subscriptions?${params.toString()}`;
}

/**
 * The subscription report (`GET /crm/reports/subscriptions`), cursor-paginated. `pending_payment` reads
 * oldest first (Finance's queue); every other status, and no status, newest first.
 *
 * @example
 * const awaiting = useSubscriptionReport({ status: "pending_payment" }, { enabled: canRunReport });
 */
export function useSubscriptionReport(
  filter: SubscriptionReportFilter = {},
  options: { readonly enabled?: boolean } = {},
) {
  const api = useApiClient();
  return useCursorList<SubscriptionReportRow>(
    [...SUBSCRIPTION_REPORT_QUERY_KEY, filter],
    (cursor, signal) => api.get(reportPath(filter, cursor), subscriptionReportPage, signal),
    { enabled: options.enabled ?? true },
  );
}
