import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  subscriptionPage,
  subscriptionView,
  type ManualPaymentRequest,
  type SubscriptionPage,
  type SubscriptionView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { ACCOUNTS_QUERY_KEY } from "./use-accounts";

/*
 * Subscriptions (Module B CRM, feature 8.3). Staff read (`crm.subscriptions.read`) is CLIENT-class (status,
 * dates, auto-renew — no payment internals). Finance records a manual bank transfer against a pending
 * subscription (`crm.subscriptions.update`): the amount is taken from the plan, not the request, and the
 * same activation runs as the gateway webhook. The RESTRICTED-FINANCE payment ledger has no read route yet.
 */

export const SUBSCRIPTIONS_QUERY_KEY = ["crm", "subscriptions"] as const;

/** One account's subscriptions (`GET /crm/subscriptions?accountId=…`, `crm.subscriptions.read`). */
export function useAccountSubscriptions(accountId: string) {
  const api = useApiClient();
  return useQuery<SubscriptionPage>({
    queryKey: [...SUBSCRIPTIONS_QUERY_KEY, { accountId }],
    queryFn: ({ signal }) =>
      api.get(`/crm/subscriptions?accountId=${accountId}&limit=50`, subscriptionPage, signal),
  });
}

/**
 * Record a manual bank transfer against a pending subscription (`POST …/record-payment`, Finance /
 * Super Admin). Activation flips the account to active, so it refreshes every subscriptions and accounts
 * query (the account detail and the Clients list alike).
 */
export function useRecordPayment() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    SubscriptionView,
    Error,
    { readonly subscriptionId: string; readonly body: ManualPaymentRequest }
  >({
    mutationFn: ({ subscriptionId, body }) =>
      api.request(`/crm/subscriptions/${subscriptionId}/record-payment`, {
        method: "POST",
        body,
        schema: subscriptionView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
      // Activation flips the account prospect -> active, so refresh both its detail AND the list: the
      // ACCOUNTS_QUERY_KEY prefix matches [...,accountId] (detail) and [...,{ query }] (list).
      void queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}
