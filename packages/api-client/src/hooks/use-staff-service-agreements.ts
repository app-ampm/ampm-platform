import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  serviceAgreementStaffPage,
  serviceAgreementStaffView,
  type ServiceAgreementStaffPage,
  type ServiceAgreementStaffView,
  type ServiceAgreementTransitionRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { STAFF_ENQUIRIES_QUERY_KEY, staffEnquiryQueryKey } from "./use-staff-enquiries";

/** The staff agreements path (`/crm/service-agreements`) is distinct from the client portal path. */
export const STAFF_SERVICE_AGREEMENTS_QUERY_KEY = ["crm", "service-agreements", "staff"] as const;

export interface StaffServiceAgreementsQuery {
  readonly status?: string;
  readonly hotelEnquiryId?: string;
  readonly accountId?: string;
  readonly cursor?: string;
}

/** The staff service agreements (`GET /crm/service-agreements`), filterable by enquiry / account / status. */
export function useStaffServiceAgreements(query: StaffServiceAgreementsQuery = {}) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.hotelEnquiryId) params.set("hotelEnquiryId", query.hotelEnquiryId);
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return useQuery<ServiceAgreementStaffPage>({
    queryKey: [...STAFF_SERVICE_AGREEMENTS_QUERY_KEY, query],
    queryFn: ({ signal }) =>
      api.get(
        `/crm/service-agreements${suffix ? `?${suffix}` : ""}`,
        serviceAgreementStaffPage,
        signal,
      ),
  });
}

/**
 * Move a service agreement along its lifecycle (`PATCH /crm/service-agreements/:id/status`):
 * draft -> sent -> accepted -> active -> completed (or cancelled). Entering/leaving `active` flips the
 * account's hotel_assistance entitlement, so the enquiry is refreshed too.
 */
export function useTransitionServiceAgreement(agreementId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<ServiceAgreementStaffView, Error, ServiceAgreementTransitionRequest>({
    mutationFn: (body) =>
      api.request(`/crm/service-agreements/${agreementId}/status`, {
        method: "PATCH",
        body,
        schema: serviceAgreementStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_SERVICE_AGREEMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
  });
}
