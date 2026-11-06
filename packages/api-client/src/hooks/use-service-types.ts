import { useQuery } from "@tanstack/react-query";
import { serviceTypesResponse, type ServiceTypesResponse } from "@ampm/core";

import { useApiClient } from "../provider";

export const SERVICE_TYPES_QUERY_KEY = ["crm", "service-types"] as const;

/** The active service-type catalogue (`GET /crm/service-types`); staff pick one when drafting an agreement. */
export function useServiceTypes() {
  const api = useApiClient();
  return useQuery<ServiceTypesResponse>({
    queryKey: SERVICE_TYPES_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/crm/service-types", serviceTypesResponse, signal),
  });
}
