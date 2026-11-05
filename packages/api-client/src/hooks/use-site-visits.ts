import { useQuery } from "@tanstack/react-query";
import { siteVisitClientPage, type SiteVisitClientPage } from "@ampm/core";

import { useApiClient } from "../provider";

/** The query key for one enquiry's site visits, so the feedback mutation can invalidate it. */
export function siteVisitsQueryKey(enquiryId: string) {
  return ["consultancy", "enquiries", enquiryId, "visits"] as const;
}

/** The client's own site visits for an enquiry (`GET /consultancy/enquiries/:id/visits`); CLIENT fields only. */
export function useSiteVisits(enquiryId: string, query: { status?: string } = {}) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  const suffix = params.toString();
  return useQuery<SiteVisitClientPage>({
    queryKey: [...siteVisitsQueryKey(enquiryId), query],
    queryFn: ({ signal }) =>
      api.get(
        `/consultancy/enquiries/${enquiryId}/visits${suffix ? `?${suffix}` : ""}`,
        siteVisitClientPage,
        signal,
      ),
    enabled: Boolean(enquiryId),
  });
}
