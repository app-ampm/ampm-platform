import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  siteVisitStaffPage,
  siteVisitStaffView,
  type SiteVisitCreateRequest,
  type SiteVisitStaffPage,
  type SiteVisitStaffView,
  type SiteVisitTransitionRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { STAFF_ENQUIRIES_QUERY_KEY, staffEnquiryQueryKey } from "./use-staff-enquiries";

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

/** Schedule a new site visit on an enquiry (`POST /consultancy-admin/site-visits`); the service also
 *  advances the enquiry to `visit_scheduled`, so the enquiry and the list are refreshed too. */
export function useCreateSiteVisit(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SiteVisitStaffView, Error, SiteVisitCreateRequest>({
    mutationFn: (body) =>
      api.request("/consultancy-admin/site-visits", {
        method: "POST",
        body,
        schema: siteVisitStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffSiteVisitsQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
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
