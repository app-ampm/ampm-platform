import { useQuery } from "@tanstack/react-query";
import { hotelCuisineOptionsView, type HotelCuisineOptionsView } from "@ampm/core";

import { useApiClient } from "../provider";

/**
 * Its own key, outside STAFF_HOTELS_QUERY_KEY: the configured list changes far less often than the
 * hotels, so a hotel write does not refetch it.
 */
export const HOTEL_CUISINE_OPTIONS_QUERY_KEY = ["hotels-admin", "cuisine-options"] as const;

/** How long the list is trusted before a refetch: a Super Admin's change shows within minutes. */
const CUISINE_OPTIONS_STALE_MS = 5 * 60 * 1000;

/**
 * The cuisine choices the staff profile editor offers (`GET /hotels-admin/cuisine-options`, every reader
 * of `hotels.hotel_profiles_client_fields.read`; D-178): the configured options (`hotel.cuisine_options`)
 * and the label for anything else ("Other"). Staff who cannot read the configuration inventory still get
 * it. Pass `enabled: false` until the editor opens, so a closed sheet sends nothing.
 *
 *   const cuisines = useHotelCuisineOptions({ enabled: open });
 *   cuisines.data?.options; // ["Indian", "Continental", …]
 */
export function useHotelCuisineOptions({ enabled = true }: { readonly enabled?: boolean } = {}) {
  const api = useApiClient();
  return useQuery<HotelCuisineOptionsView>({
    queryKey: HOTEL_CUISINE_OPTIONS_QUERY_KEY,
    queryFn: ({ signal }) =>
      api.get("/hotels-admin/cuisine-options", hotelCuisineOptionsView, signal),
    staleTime: CUISINE_OPTIONS_STALE_MS,
    enabled,
  });
}
