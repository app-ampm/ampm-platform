import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { savedHotelIdsResponse } from "@ampm/core";

import { useApiClient } from "../provider";

export const SAVED_HOTEL_IDS_QUERY_KEY = ["hotels", "saved", "ids"] as const;

/**
 * The complete set of hotel ids on the account's shortlist (`GET /hotels/saved/ids`), for a reliable
 * per-card "saved" state (B12/B12b). Its key extends the shortlist's `["hotels","saved"]` prefix, so saving
 * or removing a hotel — which invalidates that prefix — refreshes this set too, with no extra invalidation.
 * Every heart on a page mounts this hook; they share the one query key, so the lookup is fetched once.
 */
export function useSavedHotelIds() {
  const api = useApiClient();
  const query = useQuery({
    queryKey: SAVED_HOTEL_IDS_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/hotels/saved/ids", savedHotelIdsResponse, signal),
  });
  const ids = useMemo(() => new Set(query.data?.ids), [query.data]);
  return { ids, isPending: query.isPending, isError: query.isError };
}
