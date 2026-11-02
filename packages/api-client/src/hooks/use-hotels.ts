import { useQuery } from "@tanstack/react-query";
import { hotelPage, type HotelListQuery, type HotelPage } from "@ampm/core";

import { useApiClient } from "../provider";

export const HOTELS_QUERY_KEY = ["hotels"] as const;

function hotelsPath(query: Partial<HotelListQuery>): string {
  const params = new URLSearchParams();
  if (query.destinationId) params.set("destinationId", query.destinationId);
  if (query.q) params.set("q", query.q);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/hotels?${params.toString()}`;
}

/** Browse/search the hotel catalogue the entitlement unlocks (`GET /hotels`), cursor-paginated by id. */
export function useHotels(query: Partial<HotelListQuery> = {}) {
  const api = useApiClient();
  return useQuery<HotelPage>({
    queryKey: [...HOTELS_QUERY_KEY, query],
    queryFn: ({ signal }) => api.get(hotelsPath(query), hotelPage, signal),
  });
}
