import { useQuery } from "@tanstack/react-query";
import { leadView, type LeadView } from "@ampm/core";

import { useApiClient } from "../provider";
import { LEADS_QUERY_KEY } from "./use-leads";

/** The query key for a single lead, so a mutation can target or invalidate it. */
export function leadQueryKey(leadId: string) {
  return [...LEADS_QUERY_KEY, leadId] as const;
}

/** One lead for the Sales detail view (`GET /crm/leads/:leadId`, `crm.leads.read`). 404 if not visible. */
export function useLead(leadId: string) {
  const api = useApiClient();
  return useQuery<LeadView>({
    queryKey: leadQueryKey(leadId),
    queryFn: ({ signal }) => api.get(`/crm/leads/${leadId}`, leadView, signal),
    enabled: Boolean(leadId),
  });
}
