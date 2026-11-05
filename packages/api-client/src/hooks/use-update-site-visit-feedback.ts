import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  siteVisitClientView,
  type SiteVisitClientView,
  type SiteVisitFeedbackRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { siteVisitsQueryKey } from "./use-site-visits";

/**
 * Submit or update the client's own feedback on a site visit (`PATCH /consultancy/visits/:id/feedback`).
 * `enquiryId` is the visit's enquiry, so a success can refresh that enquiry's visit list.
 */
export function useUpdateSiteVisitFeedback(visitId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SiteVisitClientView, Error, SiteVisitFeedbackRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy/visits/${visitId}/feedback`, {
        method: "PATCH",
        body,
        schema: siteVisitClientView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteVisitsQueryKey(enquiryId) });
    },
  });
}
