import { useQuery } from "@tanstack/react-query";
import { savedHotelPage, type SavedHotelListQuery, type SavedHotelPage } from "@ampm/core";

import { useApiClient } from "../provider";

export const SAVED_HOTELS_QUERY_KEY = ["hotels", "saved"] as const;

function savedHotelsPath(query: Partial<SavedHotelListQuery>): string {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/hotels/saved?${params.toString()}`;
}

/** The account's hotel shortlist (`GET /hotels/saved`), cursor-paginated by saved-hotel id. */
export function useSavedHotels(query: Partial<SavedHotelListQuery> = {}) {
  const api = useApiClient();
  return useQuery<SavedHotelPage>({
    queryKey: [...SAVED_HOTELS_QUERY_KEY, query],
    queryFn: ({ signal }) => api.get(savedHotelsPath(query), savedHotelPage, signal),
  });
}
