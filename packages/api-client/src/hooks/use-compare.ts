import { useQuery } from "@tanstack/react-query";
import {
  HOTEL_COMPARE_MAX,
  HOTEL_COMPARE_MIN,
  hotelCompareResponse,
  type HotelCompareResponse,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTELS_QUERY_KEY } from "./use-hotels";

/**
 * Compare 2–4 of the caller's SAVED hotels side by side (`GET /hotels/compare`, CP-06). The query is
 * disabled until 2–4 ids are chosen; the server returns only ids on the caller's shortlist and in reach
 * (denial equals absence), in the order asked, so the result may hold fewer hotels than requested.
 */
export function useCompare(ids: readonly string[]) {
  const api = useApiClient();
  return useQuery<HotelCompareResponse>({
    queryKey: [...HOTELS_QUERY_KEY, "compare", [...ids]],
    queryFn: ({ signal }) =>
      api.get(`/hotels/compare?ids=${ids.join(",")}`, hotelCompareResponse, signal),
    enabled: ids.length >= HOTEL_COMPARE_MIN && ids.length <= HOTEL_COMPARE_MAX,
  });
}
