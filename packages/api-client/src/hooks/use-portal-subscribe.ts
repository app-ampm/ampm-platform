import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  subscriptionCreateResponse,
  type PortalSubscriptionCreateRequest,
  type SubscriptionCreateResponse,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { ME_QUERY_KEY } from "./use-me";

/**
 * A signed-in client starts a subscription for their own account (`POST /crm/portal/subscriptions`, 201).
 * The account is derived server-side from the principal. Returns the pending subscription + gateway order.
 */
export function usePortalSubscribe() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SubscriptionCreateResponse, Error, PortalSubscriptionCreateRequest>({
    mutationFn: (body) =>
      api.request("/crm/portal/subscriptions", {
        method: "POST",
        body,
        schema: subscriptionCreateResponse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
