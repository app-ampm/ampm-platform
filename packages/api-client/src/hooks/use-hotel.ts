import { useQuery } from "@tanstack/react-query";
import { hotelView, type HotelView } from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTELS_QUERY_KEY } from "./use-hotels";

/** The query key for a single hotel, so a mutation can target or invalidate it. */
export function hotelQueryKey(hotelId: string) {
  return [...HOTELS_QUERY_KEY, hotelId] as const;
}

/** One hotel for the detail view (`GET /hotels/:hotelId`). 404 when outside the principal's reach. */
export function useHotel(hotelId: string) {
  const api = useApiClient();
  return useQuery<HotelView>({
    queryKey: hotelQueryKey(hotelId),
    queryFn: ({ signal }) => api.get(`/hotels/${hotelId}`, hotelView, signal),
    enabled: Boolean(hotelId),
  });
}
