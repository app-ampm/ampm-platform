import { useQuery } from "@tanstack/react-query";
import { leadPage, type LeadListQuery, type LeadPage } from "@ampm/core";

import { useApiClient } from "../provider";

export const LEADS_QUERY_KEY = ["crm", "leads"] as const;

function leadsPath(query: Partial<LeadListQuery>): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.ownerUserId) params.set("ownerUserId", query.ownerUserId);
  if (query.source) params.set("source", query.source);
  if (query.q) params.set("q", query.q);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/crm/leads?${params.toString()}`;
}

/** The Sales lead pipeline (`GET /crm/leads`, `crm.leads.read`), cursor-paginated by lead id. */
export function useLeads(query: Partial<LeadListQuery> = {}) {
  const api = useApiClient();
  return useQuery<LeadPage>({
    queryKey: [...LEADS_QUERY_KEY, query],
    queryFn: ({ signal }) => api.get(leadsPath(query), leadPage, signal),
  });
}
