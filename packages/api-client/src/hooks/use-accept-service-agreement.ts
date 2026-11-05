import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  serviceAgreementClientView,
  type ServiceAgreementAcceptRequest,
  type ServiceAgreementClientView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { SERVICE_AGREEMENTS_QUERY_KEY, serviceAgreementQueryKey } from "./use-service-agreements";

/**
 * Accept a service agreement AMPM sent (`POST /crm/portal/service-agreements/:id/accept`, GP-5). The
 * client's explicit consent (`termsAccepted: true`) moves a `sent` agreement to `accepted`; Sales then
 * activates it, which turns on the service's entitlement. On success it refreshes the agreement and list.
 */
export function useAcceptServiceAgreement(agreementId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<ServiceAgreementClientView, Error, ServiceAgreementAcceptRequest>({
    mutationFn: (body) =>
      api.request(`/crm/portal/service-agreements/${agreementId}/accept`, {
        method: "POST",
        body,
        schema: serviceAgreementClientView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceAgreementQueryKey(agreementId) });
      void queryClient.invalidateQueries({ queryKey: SERVICE_AGREEMENTS_QUERY_KEY });
    },
  });
}
