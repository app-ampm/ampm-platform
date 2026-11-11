import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savedHotelView, type SavedHotelNoteUpdateRequest, type SavedHotelView } from "@ampm/core";

import { useApiClient } from "../provider";
import { SAVED_HOTELS_QUERY_KEY } from "./use-saved-hotels";

/**
 * Edit the client's own note on a shortlisted hotel (`PATCH /hotels/:hotelId/save`; saved_hotels=write).
 * On success it invalidates the shortlist so the Saved view shows the new note. The key prefix also covers
 * the saved-ids lookup, which the note never changes — a harmless, cheap refetch.
 */
export function useUpdateSavedNote(hotelId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SavedHotelView, Error, SavedHotelNoteUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/hotels/${hotelId}/save`, { method: "PATCH", body, schema: savedHotelView }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SAVED_HOTELS_QUERY_KEY });
    },
  });
}
