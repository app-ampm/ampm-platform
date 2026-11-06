import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  siteVisitStaffPage,
  siteVisitStaffView,
  type SiteVisitStaffPage,
  type SiteVisitStaffView,
  type SiteVisitTransitionRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { staffEnquiryQueryKey } from "./use-staff-enquiries";

export const STAFF_SITE_VISITS_QUERY_KEY = ["consultancy-admin", "site-visits"] as const;

export function staffSiteVisitsQueryKey(enquiryId: string) {
  return [...STAFF_SITE_VISITS_QUERY_KEY, { enquiryId }] as const;
}

/** The staff site visits for an enquiry (`GET /consultancy-admin/site-visits?enquiryId=`): the client
 *  feedback plus the internal attendees and outcome a client never sees. */
export function useStaffSiteVisits(enquiryId: string) {
  const api = useApiClient();
  return useQuery<SiteVisitStaffPage>({
    queryKey: staffSiteVisitsQueryKey(enquiryId),
    queryFn: ({ signal }) =>
      api.get(`/consultancy-admin/site-visits?enquiryId=${enquiryId}`, siteVisitStaffPage, signal),
    enabled: Boolean(enquiryId),
  });
}

/** Move a site visit along its lifecycle (`PATCH /consultancy-admin/site-visits/:id/status`):
 *  proposed -> confirmed -> completed, or cancelled from either non-terminal state. */
export function useTransitionSiteVisit(visitId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SiteVisitStaffView, Error, SiteVisitTransitionRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy-admin/site-visits/${visitId}/status`, {
        method: "PATCH",
        body,
        schema: siteVisitStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffSiteVisitsQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
    },
  });
}
