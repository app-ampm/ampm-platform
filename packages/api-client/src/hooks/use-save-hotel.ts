import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savedHotelView, type SavedHotelView } from "@ampm/core";

import { useApiClient } from "../provider";
import { SAVED_HOTELS_QUERY_KEY } from "./use-saved-hotels";

/**
 * Save a hotel to the account shortlist (`POST /hotels/:hotelId/save`, 201; saved_hotels=write). The save
 * is idempotent server-side (one row per account+hotel). On success it invalidates the shortlist query so
 * the Saved view and the detail's save state refresh.
 */
export function useSaveHotel(hotelId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SavedHotelView, Error, void>({
    mutationFn: () =>
      api.request(`/hotels/${hotelId}/save`, { method: "POST", schema: savedHotelView }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SAVED_HOTELS_QUERY_KEY });
    },
  });
}
