import { useQuery } from "@tanstack/react-query";
import {
  serviceAgreementClientPage,
  serviceAgreementClientView,
  type ServiceAgreementClientPage,
  type ServiceAgreementClientView,
} from "@ampm/core";

import { useApiClient } from "../provider";

export const SERVICE_AGREEMENTS_QUERY_KEY = ["crm", "portal", "service-agreements"] as const;

/** The query key for one agreement, so the accept mutation can target or invalidate it. */
export function serviceAgreementQueryKey(agreementId: string) {
  return [...SERVICE_AGREEMENTS_QUERY_KEY, agreementId] as const;
}

export interface ServiceAgreementsQuery {
  readonly status?: string;
  readonly hotelEnquiryId?: string;
  readonly cursor?: string;
}

/** The client's own service agreements (`GET /crm/portal/service-agreements`); CLIENT fields only. */
export function useServiceAgreements(query: ServiceAgreementsQuery = {}) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.hotelEnquiryId) params.set("hotelEnquiryId", query.hotelEnquiryId);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return useQuery<ServiceAgreementClientPage>({
    queryKey: [...SERVICE_AGREEMENTS_QUERY_KEY, query],
    queryFn: ({ signal }) =>
      api.get(
        `/crm/portal/service-agreements${suffix ? `?${suffix}` : ""}`,
        serviceAgreementClientPage,
        signal,
      ),
  });
}

/** One of the client's own agreements (`GET /crm/portal/service-agreements/:id`). */
export function useServiceAgreement(agreementId: string) {
  const api = useApiClient();
  return useQuery<ServiceAgreementClientView>({
    queryKey: serviceAgreementQueryKey(agreementId),
    queryFn: ({ signal }) =>
      api.get(`/crm/portal/service-agreements/${agreementId}`, serviceAgreementClientView, signal),
    enabled: Boolean(agreementId),
  });
}
