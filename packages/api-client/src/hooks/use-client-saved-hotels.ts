import { savedHotelStaffPage, type SavedHotelStaffView } from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList, type CursorListOptions } from "./use-cursor-list";

/*
 * Clients' saved hotels as staff read them (`GET /hotels-admin/saved-hotels`, `hotels.saved_hotels.read`:
 * SA, SM, HT). Read-only: the client alone adds or removes a saved hotel, through `useSaveHotel` and its
 * siblings, which serve the client's own list under a different key.
 */

export const CLIENT_SAVED_HOTELS_QUERY_KEY = ["hotels-admin", "saved-hotels"] as const;

export interface ClientSavedHotelsQuery {
  /** One client's whole list (the client hub); every client's when absent. */
  readonly accountId?: string | undefined;
  /** Every client who saved one hotel (the hotel's staff page); every hotel when absent. */
  readonly hotelId?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

/**
 * The list's address for a query, with only the filters given, in a fixed order.
 *
 * @example
 * clientSavedHotelsPath({ accountId: "0192…" }); // "/hotels-admin/saved-hotels?accountId=0192…&limit=50"
 */
export function clientSavedHotelsPath(query: ClientSavedHotelsQuery): string {
  const params = new URLSearchParams();
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.hotelId) params.set("hotelId", query.hotelId);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/hotels-admin/saved-hotels?${params.toString()}`;
}

/**
 * Clients' saved hotels, newest first, cursor-paginated for a Load more footer. Pass `enabled: false`
 * when the signed-in role lacks the grant, so no refused request is sent.
 *
 *   const saved = useClientSavedHotels({ accountId }, { enabled: canRead });
 *   const savers = useClientSavedHotels({ hotelId }, { enabled: canRead });
 */
export function useClientSavedHotels(
  query: Omit<ClientSavedHotelsQuery, "cursor"> = {},
  options: CursorListOptions = {},
) {
  const api = useApiClient();
  return useCursorList<SavedHotelStaffView>(
    [...CLIENT_SAVED_HOTELS_QUERY_KEY, query],
    (cursor, signal) =>
      api.get(clientSavedHotelsPath({ ...query, cursor }), savedHotelStaffPage, signal),
    options,
  );
}
