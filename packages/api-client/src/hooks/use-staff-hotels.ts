import { useQuery } from "@tanstack/react-query";
import {
  hotelStaffDetailView,
  hotelStaffPage,
  type HotelStaffDetailView,
  type HotelStaffListQuery,
  type HotelStaffPage,
} from "@ampm/core";

import { useApiClient } from "../provider";

export const STAFF_HOTELS_QUERY_KEY = ["hotels-admin", "hotels"] as const;

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
