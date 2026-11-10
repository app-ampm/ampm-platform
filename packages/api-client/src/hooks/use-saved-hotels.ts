import { savedHotelPage, type SavedHotelListQuery, type SavedHotelView } from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList } from "./use-cursor-list";

export const SAVED_HOTELS_QUERY_KEY = ["hotels", "saved"] as const;

function savedHotelsPath(query: Partial<SavedHotelListQuery>): string {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/hotels/saved?${params.toString()}`;
}

/** The account's hotel shortlist (`GET /hotels/saved`), cursor-paginated by saved-hotel id with a "Load more" footer (B10). */
export function useSavedHotels(query: Partial<SavedHotelListQuery> = {}) {
  const api = useApiClient();
  return useCursorList<SavedHotelView>([...SAVED_HOTELS_QUERY_KEY, query], (cursor, signal) =>
    api.get(savedHotelsPath({ ...query, cursor }), savedHotelPage, signal),
  );
}
