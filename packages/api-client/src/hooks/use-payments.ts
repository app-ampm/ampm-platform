import { paymentPage, type PaymentDirection, type PaymentFinanceView } from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList } from "./use-cursor-list";

/*
 * The finance payment ledger (Module B CRM; `crm.payments.read` — FA/SA). The RESTRICTED-FINANCE view
 * of inbound and outbound payments, read-only, filtered by account and direction. Pass `enabled: false`
 * when the signed-in role lacks the key, so a denied principal never drives a forever-refused retry.
 */

export const PAYMENTS_QUERY_KEY = ["crm", "payments"] as const;

export interface PaymentsQuery {
  readonly accountId?: string | undefined;
  readonly direction?: PaymentDirection | undefined;
}

function paymentsPath(query: PaymentsQuery, cursor: string | undefined): string {
  const params = new URLSearchParams({ limit: "50" });
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.direction) params.set("direction", query.direction);
  if (cursor) params.set("cursor", cursor);
  return `/crm/payments?${params.toString()}`;
}

/** The payment ledger (`GET /crm/payments`, `crm.payments.read`), cursor-paginated; `enabled` gates the role. */
export function usePayments(
  query: PaymentsQuery = {},
  options: { readonly enabled?: boolean } = {},
) {
  const api = useApiClient();
  return useCursorList<PaymentFinanceView>(
    [...PAYMENTS_QUERY_KEY, query],
    (cursor, signal) => api.get(paymentsPath(query, cursor), paymentPage, signal),
    { enabled: options.enabled ?? true },
  );
}
