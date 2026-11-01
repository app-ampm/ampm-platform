import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savedHotelRemovedResponse, type SavedHotelRemovedResponse } from "@ampm/core";

import { useApiClient } from "../provider";
import { SAVED_HOTELS_QUERY_KEY } from "./use-saved-hotels";

/**
 * Remove a hotel from the account shortlist (`DELETE /hotels/:hotelId/save`; saved_hotels=write). The
 * removal is idempotent server-side. On success it invalidates the shortlist query so the Saved view and
 * the detail's save state refresh.
 */
export function useUnsaveHotel(hotelId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SavedHotelRemovedResponse, Error, void>({
    mutationFn: () =>
      api.request(`/hotels/${hotelId}/save`, {
        method: "DELETE",
        schema: savedHotelRemovedResponse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SAVED_HOTELS_QUERY_KEY });
    },
  });
}
