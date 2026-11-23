import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  destinationList,
  destinationView,
  hotelStaffDetail,
  hotelStaffPage,
  type DestinationCreateRequest,
  type DestinationListItemView,
  type DestinationUpdateRequest,
  type DestinationView,
  type HotelCreateRequest,
  type HotelStaffDetail,
  type HotelStaffListItem,
  type HotelStaffListQuery,
  type HotelUpdateRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList } from "./use-cursor-list";

export const STAFF_HOTELS_QUERY_KEY = ["hotels-admin", "hotels"] as const;
export const STAFF_DESTINATIONS_QUERY_KEY = ["hotels-admin", "destinations"] as const;

/** The query key for one staff hotel's detail. */
export function staffHotelQueryKey(hotelId: string) {
  return [...STAFF_HOTELS_QUERY_KEY, hotelId] as const;
}

function toQueryString(query: Partial<HotelStaffListQuery>): string {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.destinationId) params.set("destinationId", query.destinationId);
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/**
 * The staff hotel catalogue (`GET /hotels-admin/hotels`, `hotels.hotel_profiles_client_fields.read`):
 * the private database the Hotel team and Super Admin manage, name-ordered and cursor-paginated, 50 a
 * page: `items` grow with `loadMore` while `hasMore` ({@link useCursorList}). Each item is the model of
 * the reader's audience: the internal rating and notes only for a reader of them (D-171). Staff-only,
 * gated server-side; separate from the entitlement-gated client discovery list ({@link useHotels}).
 *
 *   const hotels = useStaffHotels();
 *   hotels.items; // the loaded pages, flattened
 */
export function useStaffHotels(query: Partial<Omit<HotelStaffListQuery, "cursor">> = {}) {
  const api = useApiClient();
  return useCursorList<HotelStaffListItem>([...STAFF_HOTELS_QUERY_KEY, query], (cursor, signal) =>
    api.get(
      `/hotels-admin/hotels${toQueryString({ ...query, ...(cursor ? { cursor } : {}) })}`,
      hotelStaffPage,
      signal,
    ),
  );
}

/**
 * One staff hotel with its rooms and venues (`GET /hotels-admin/hotels/:id`), in the model of the
 * reader's audience (D-171): its contacts and its internal rating and notes are there only for a reader
 * of them, so narrow with `"contacts" in hotel`. The hotel's media, rate cards and references are
 * separate surfaces (Module N / 9.2/9.3).
 */
export function useStaffHotel(hotelId: string) {
  const api = useApiClient();
  return useQuery<HotelStaffDetail>({
    queryKey: staffHotelQueryKey(hotelId),
    queryFn: ({ signal }) => api.get(`/hotels-admin/hotels/${hotelId}`, hotelStaffDetail, signal),
  });
}

/**
 * Every destination a hotel can be filed under (`GET /hotels-admin/destinations`,
 * `hotels.destinations.read`), each with the count of its hotels: the whole reference set, name-ordered
 * and not reach-scoped — the Destinations screen (TW-20) and the hotel editor's picker, unlike the client
 * browse which hides empty destinations. Staff-only, gated server-side. Pass `enabled: false` where the
 * list is wanted only later (the hotel editor reads a destination's country only while it is open).
 *
 *   const destinations = useStaffDestinations({ enabled: open });
 */
export function useStaffDestinations({ enabled = true }: { readonly enabled?: boolean } = {}) {
  const api = useApiClient();
  return useQuery<DestinationListItemView[]>({
    queryKey: STAFF_DESTINATIONS_QUERY_KEY,
    queryFn: async ({ signal }) =>
      (await api.get("/hotels-admin/destinations", destinationList, signal)).items,
    enabled,
  });
}

/**
 * Refresh the destination list after a destination write, and the staff hotels too: each hotel's detail
 * carries its destination's name and place.
 */
function useRefreshStaffDestinations(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: STAFF_DESTINATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: STAFF_HOTELS_QUERY_KEY });
  };
}

/**
 * Add a destination (`POST /hotels-admin/destinations`, `hotels.destinations.create`; TW-20). The server
 * makes the slug from the name when none is sent, and refuses a slug already in use with a 409.
 *
 *   const create = useCreateDestination();
 *   create.mutate({ name: "Udaipur", state: "Rajasthan", status: "active" });
 */
export function useCreateDestination() {
  const api = useApiClient();
  const refresh = useRefreshStaffDestinations();
  return useMutation<DestinationView, Error, DestinationCreateRequest>({
    mutationFn: (body) =>
      api.request("/hotels-admin/destinations", { method: "POST", body, schema: destinationView }),
    onSuccess: () => refresh(),
  });
}

/**
 * Edit a destination (`PATCH /hotels-admin/destinations/:id`, `hotels.destinations.update`; TW-20): any
 * field but the slug, which never changes. Publishing it to the website is its `publicVisible` flag,
 * audited by the server.
 */
export function useUpdateDestination() {
  const api = useApiClient();
  const refresh = useRefreshStaffDestinations();
  return useMutation<
    DestinationView,
    Error,
    { readonly destinationId: string; readonly body: DestinationUpdateRequest }
  >({
    mutationFn: ({ destinationId, body }) =>
      api.request(`/hotels-admin/destinations/${destinationId}`, {
        method: "PATCH",
        body,
        schema: destinationView,
      }),
    onSuccess: () => refresh(),
  });
}

/** Refresh the staff catalogue after a hotel write, plus the one hotel's detail when editing. */
function useRefreshStaffHotels(): (hotelId?: string) => void {
  const queryClient = useQueryClient();
  return (hotelId) => {
    void queryClient.invalidateQueries({ queryKey: STAFF_HOTELS_QUERY_KEY });
    if (hotelId) void queryClient.invalidateQueries({ queryKey: staffHotelQueryKey(hotelId) });
  };
}

/**
 * Add a hotel to the staff catalogue (`POST /hotels-admin/hotels`,
 * `hotels.hotel_profiles_client_fields.create`). Returns the new hotel in the reader's model and
 * refreshes the list. Setting the internal rating or notes also needs their own key, or the server
 * answers 403.
 */
export function useCreateHotel() {
  const api = useApiClient();
  const refresh = useRefreshStaffHotels();
  return useMutation<HotelStaffDetail, Error, HotelCreateRequest>({
    mutationFn: (body) =>
      api.request("/hotels-admin/hotels", { method: "POST", body, schema: hotelStaffDetail }),
    onSuccess: (hotel) => refresh(hotel.id),
  });
}

/**
 * Edit a hotel's profile (`PATCH /hotels-admin/hotels/:id`,
 * `hotels.hotel_profiles_client_fields.update`). Refreshes the catalogue and the hotel's detail. A body
 * that names the internal rating or notes also needs `hotels.hotel_internal_rating_notes.update`.
 */
export function useUpdateHotel() {
  const api = useApiClient();
  const refresh = useRefreshStaffHotels();
  return useMutation<
    HotelStaffDetail,
    Error,
    { readonly hotelId: string; readonly body: HotelUpdateRequest }
  >({
    mutationFn: ({ hotelId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}`, {
        method: "PATCH",
        body,
        schema: hotelStaffDetail,
      }),
    onSuccess: (hotel) => refresh(hotel.id),
  });
}
