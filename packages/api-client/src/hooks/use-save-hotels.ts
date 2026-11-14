import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savedHotelView } from "@ampm/core";

import { useApiClient } from "../provider";
import { SAVED_HOTELS_QUERY_KEY } from "./use-saved-hotels";

/**
 * Save several hotels to the account shortlist at once — one idempotent `POST /hotels/:id/save` per id
 * (saved_hotels=write), run together. Discovery's "compare on cards" (B12b) uses it: the compare endpoint
 * returns only saved hotels, so comparing browse cards first puts them on the shortlist. It rejects if any
 * save fails (the caller keeps the picks to retry) and invalidates the shortlist whether it settled or
 * failed (`onSettled`), so a partial batch — some saved, one failed — still refreshes the Saved view and
 * the per-card save state to match what actually landed on the server.
 */
export function useSaveHotels() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<void, Error, readonly string[]>({
    mutationFn: async (hotelIds) => {
      await Promise.all(
        hotelIds.map((hotelId) =>
          api.request(`/hotels/${hotelId}/save`, { method: "POST", schema: savedHotelView }),
        ),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SAVED_HOTELS_QUERY_KEY });
    },
  });
}
