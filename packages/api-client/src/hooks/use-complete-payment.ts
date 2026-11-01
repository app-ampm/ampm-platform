import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  devCompletePaymentResponse,
  type DevCompletePaymentRequest,
  type DevCompletePaymentResponse,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { ME_QUERY_KEY } from "./use-me";

/**
 * Development-only: complete a pending subscription's stub gateway payment
 * (`POST /crm/portal/complete-payment`), which runs the real activation. On success it invalidates `/me`
 * so the newly-granted entitlement (hotel discovery) shows immediately. The API refuses this outside a
 * stub, non-production config.
 */
export function useCompletePayment() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<DevCompletePaymentResponse, Error, DevCompletePaymentRequest>({
    mutationFn: (body) =>
      api.request("/crm/portal/complete-payment", {
        method: "POST",
        body,
        schema: devCompletePaymentResponse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}
