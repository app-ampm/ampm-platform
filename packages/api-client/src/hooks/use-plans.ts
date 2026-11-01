import { useQuery } from "@tanstack/react-query";
import { plansResponse, type PlansResponse } from "@ampm/core";

import { useApiClient } from "../provider";

export const PLANS_QUERY_KEY = ["crm", "plans"] as const;

/** The public subscription plan catalogue (`GET /crm/plans`); no authentication needed. */
export function usePlans() {
  const api = useApiClient();
  return useQuery<PlansResponse>({
    queryKey: PLANS_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/crm/plans", plansResponse, signal),
  });
}
