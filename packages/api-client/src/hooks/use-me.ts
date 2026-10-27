import { useQuery } from "@tanstack/react-query";
import { meResponse, type MeResponse } from "@ampm/core";

import { useApiClient } from "../provider";

export const ME_QUERY_KEY = ["me"] as const;

/** The signed-in principal from `GET /me`; the apps keep it as their session state. */
export function useMe() {
  const api = useApiClient();
  return useQuery<MeResponse>({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/me", meResponse, signal),
  });
}
