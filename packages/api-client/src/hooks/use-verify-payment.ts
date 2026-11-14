import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  portalVerifyPaymentResponse,
  type PortalVerifyPaymentRequest,
  type PortalVerifyPaymentResponse,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { ME_QUERY_KEY } from "./use-me";

/**
 * Confirm a Razorpay hosted-checkout payment (`POST /crm/portal/verify-payment`). The signed-in client
 * posts back the checkout result (payment id, order id, signature) for their OWN pending subscription;
 * the server verifies the signature and runs the same activation the webhook runs. On success it
 * invalidates `/me` so the newly-granted entitlement (hotel discovery) shows immediately.
 */
export function useVerifyPayment() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<PortalVerifyPaymentResponse, Error, PortalVerifyPaymentRequest>({
    mutationFn: (body) =>
      api.request("/crm/portal/verify-payment", {
        method: "POST",
        body,
        schema: portalVerifyPaymentResponse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
