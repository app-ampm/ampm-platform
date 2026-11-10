import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { hotelPage, type HotelListQuery, type HotelPage } from "@ampm/core";

import { useApiClient } from "../provider";

export const HOTELS_QUERY_KEY = ["hotels"] as const;

function hotelsPath(query: Partial<HotelListQuery>): string {
  const params = new URLSearchParams();
  if (query.destinationId) params.set("destinationId", query.destinationId);
  if (query.q) params.set("q", query.q);
  // Discovery filters (feature 9.4, CP-04). Each is omitted when unset; the numeric ones are guarded on
  // truthiness, matching the repository (a 0 is not a filter). verifiedRatesOnly only ever sends "true".
  if (query.star) params.set("star", query.star);
  if (query.minRooms) params.set("minRooms", String(query.minRooms));
  if (query.minGuestCapacity) params.set("minGuestCapacity", String(query.minGuestCapacity));
  if (query.verifiedRatesOnly) params.set("verifiedRatesOnly", "true");
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/hotels?${params.toString()}`;
}

/**
 * Browse/search the hotel catalogue the entitlement unlocks (`GET /hotels`), cursor-paginated by id.
 * Each filter combination is its own query key; `keepPreviousData` holds the last results on screen while
 * the next load runs, so a live-applied filter refines the list in place instead of flashing a skeleton.
 */
export function useHotels(query: Partial<HotelListQuery> = {}) {
  const api = useApiClient();
  return useQuery<HotelPage>({
    queryKey: [...HOTELS_QUERY_KEY, query],
    queryFn: ({ signal }) => api.get(hotelsPath(query), hotelPage, signal),
    placeholderData: keepPreviousData,
  });
}
