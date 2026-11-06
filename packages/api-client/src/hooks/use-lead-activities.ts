import { useQuery } from "@tanstack/react-query";
import { leadActivityList, type LeadActivityList } from "@ampm/core";

import { useApiClient } from "../provider";
import { LEADS_QUERY_KEY } from "./use-leads";

/** A lead's activity timeline (`GET /crm/leads/:leadId/activities`, `crm.leads.read`). Not paginated. */
export function useLeadActivities(leadId: string) {
  const api = useApiClient();
  return useQuery<LeadActivityList>({
    queryKey: [...LEADS_QUERY_KEY, leadId, "activities"],
    queryFn: ({ signal }) => api.get(`/crm/leads/${leadId}/activities`, leadActivityList, signal),
    enabled: Boolean(leadId),
  });
}
