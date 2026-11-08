import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  destinationView,
  hotelStaffDetailView,
  hotelStaffPage,
  type DestinationView,
  type HotelCreateRequest,
  type HotelStaffDetailView,
  type HotelStaffListQuery,
  type HotelStaffPage,
  type HotelUpdateRequest,
} from "@ampm/core";
import { z } from "zod";

import { useApiClient } from "../provider";

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
 * the private database the Hotel team and Super Admin manage, cursor-paginated. Staff-only, gated
 * server-side; separate from the entitlement-gated client discovery list ({@link useHotels}).
 */
export function useStaffHotels(query: Partial<HotelStaffListQuery> = {}) {
  const api = useApiClient();
  return useQuery<HotelStaffPage>({
    queryKey: [...STAFF_HOTELS_QUERY_KEY, query],
    queryFn: ({ signal }) =>
      api.get(`/hotels-admin/hotels${toQueryString(query)}`, hotelStaffPage, signal),
  });
}

/**
 * One staff hotel with its rooms, venues and contacts (`GET /hotels-admin/hotels/:id`). The staff
 * detail view; the hotel's media, rate cards and references are separate surfaces (Module N / 9.2/9.3).
 */
export function useStaffHotel(hotelId: string) {
  const api = useApiClient();
  return useQuery<HotelStaffDetailView>({
    queryKey: staffHotelQueryKey(hotelId),
    queryFn: ({ signal }) =>
      api.get(`/hotels-admin/hotels/${hotelId}`, hotelStaffDetailView, signal),
  });
}

/** The staff destination list wrapper (`{ items: DestinationView[] }`). */
const staffDestinationList = z.object({ items: z.array(destinationView) }).strict();

/**
 * Every destination a hotel can be filed under (`GET /hotels-admin/destinations`,
 * `hotels.destinations.read`): the whole reference set, name-ordered and not reach-scoped — the picker
 * source for the hotel profile editor, unlike the client browse which hides empty destinations.
 * Staff-only, gated server-side.
 */
export function useStaffDestinations() {
  const api = useApiClient();
  return useQuery<DestinationView[]>({
    queryKey: STAFF_DESTINATIONS_QUERY_KEY,
    queryFn: async ({ signal }) =>
      (await api.get("/hotels-admin/destinations", staffDestinationList, signal)).items,
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
 * `hotels.hotel_profiles_client_fields.create`). Returns the new profile and refreshes the list.
 */
export function useCreateHotel() {
  const api = useApiClient();
  const refresh = useRefreshStaffHotels();
  return useMutation<HotelStaffDetailView, Error, HotelCreateRequest>({
    mutationFn: (body) =>
      api.request("/hotels-admin/hotels", { method: "POST", body, schema: hotelStaffDetailView }),
    onSuccess: (hotel) => refresh(hotel.id),
  });
}

/**
 * Edit a hotel's profile (`PATCH /hotels-admin/hotels/:id`,
 * `hotels.hotel_profiles_client_fields.update`). Refreshes the catalogue and the hotel's detail.
 */
export function useUpdateHotel() {
  const api = useApiClient();
  const refresh = useRefreshStaffHotels();
  return useMutation<
    HotelStaffDetailView,
    Error,
    { readonly hotelId: string; readonly body: HotelUpdateRequest }
  >({
    mutationFn: ({ hotelId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}`, {
        method: "PATCH",
        body,
        schema: hotelStaffDetailView,
      }),
    onSuccess: (hotel) => refresh(hotel.id),
  });
}
