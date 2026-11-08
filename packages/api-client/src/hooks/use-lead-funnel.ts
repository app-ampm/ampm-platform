import { useQuery } from "@tanstack/react-query";
import { leadFunnelView, type LeadFunnelQuery, type LeadFunnelView } from "@ampm/core";

import { useApiClient } from "../provider";

/*
 * The lead-source conversion funnel (TW-83, AC-01.7): counts by status and by source over an optional
 * date window. Gated by the §5.16 report key `reports.lead_source_conversion_funnel.read` (SA/SM) — not
 * `crm.leads.read`, so the Hotel team, who may read leads, cannot run it. Pass `enabled: false` when the
 * role lacks the key so a denied principal never drives a forever-refused retry.
 */

export const LEAD_FUNNEL_QUERY_KEY = ["crm", "reports", "lead-funnel"] as const;

/** The lead funnel report (`GET /crm/reports/lead-funnel`); `enabled` gates it on the role. */
export function useLeadFunnel(
  query: LeadFunnelQuery = {},
  options: { readonly enabled?: boolean } = {},
) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();
  return useQuery<LeadFunnelView>({
    queryKey: [...LEAD_FUNNEL_QUERY_KEY, query],
    queryFn: ({ signal }) =>
      api.get(`/crm/reports/lead-funnel${qs ? `?${qs}` : ""}`, leadFunnelView, signal),
    enabled: options.enabled ?? true,
  });
}
