import { useQuery } from "@tanstack/react-query";
import { destinationBrowseResponse, type DestinationBrowseResponse } from "@ampm/core";

import { useApiClient } from "../provider";

export const DESTINATIONS_QUERY_KEY = ["hotels", "destinations"] as const;

/**
 * The destinations a client may browse (`GET /hotels/destinations`, CP-01/02, feature 9.4b): reach-scoped,
 * only those with active hotels, each with its in-reach hotel count. A bounded reference set, not paginated.
 */
export function useDestinations() {
  const api = useApiClient();
  return useQuery<DestinationBrowseResponse>({
    queryKey: DESTINATIONS_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/hotels/destinations", destinationBrowseResponse, signal),
  });
}
