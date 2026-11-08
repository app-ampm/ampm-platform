import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  hotelContactView,
  roomCategoryView,
  venueView,
  type HotelContactCreateRequest,
  type HotelContactUpdateRequest,
  type HotelContactView,
  type RoomCategoryCreateRequest,
  type RoomCategoryUpdateRequest,
  type RoomCategoryView,
  type VenueCreateRequest,
  type VenueUpdateRequest,
  type VenueView,
} from "@ampm/core";
import { z } from "zod";

import { useApiClient } from "../provider";
import { staffHotelQueryKey } from "./use-staff-hotels";

/*
 * Staff hotel subresource mutations (Module C, feature 9.1): a hotel's room categories, venues and
 * contacts. They have no dedicated read endpoint — they are read nested on the staff hotel detail
 * (`GET /hotels-admin/hotels/:id`), so every write invalidates that detail. All staff-gated server-side
 * (rooms/venues under `hotels.room_categories_venues.*`, contacts under `hotels.hotel_contacts.*`,
 * RESTRICTED-CONTACT). Deletes are soft; the server verifies the child belongs to the hotel (404 else).
 */

/** Delete returns only `{ id }`; the caller does not use it. */
const deletedResponse = z.unknown();

/** Rooms/venues/contacts live on the hotel detail, so a write refreshes that detail. */
function useRefreshHotelDetail(hotelId: string): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: staffHotelQueryKey(hotelId) });
}

/** Add a room category to a hotel (`POST /hotels-admin/hotels/:id/rooms`). */
export function useCreateRoom(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<RoomCategoryView, Error, RoomCategoryCreateRequest>({
    mutationFn: (body) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rooms`, {
        method: "POST",
        body,
        schema: roomCategoryView,
      }),
    onSuccess: refresh,
  });
}

/** Edit a room category (`PATCH /hotels-admin/hotels/:id/rooms/:roomId`). */
export function useUpdateRoom(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<
    RoomCategoryView,
    Error,
    { readonly roomId: string; readonly body: RoomCategoryUpdateRequest }
  >({
    mutationFn: ({ roomId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rooms/${roomId}`, {
        method: "PATCH",
        body,
        schema: roomCategoryView,
      }),
    onSuccess: refresh,
  });
}

/** Remove a room category (`DELETE /hotels-admin/hotels/:id/rooms/:roomId`; soft delete). */
export function useDeleteRoom(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<unknown, Error, string>({
    mutationFn: (roomId) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rooms/${roomId}`, {
        method: "DELETE",
        schema: deletedResponse,
      }),
    onSuccess: refresh,
  });
}

/** Add a venue to a hotel (`POST /hotels-admin/hotels/:id/venues`). */
export function useCreateVenue(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<VenueView, Error, VenueCreateRequest>({
    mutationFn: (body) =>
      api.request(`/hotels-admin/hotels/${hotelId}/venues`, {
        method: "POST",
        body,
        schema: venueView,
      }),
    onSuccess: refresh,
  });
}

/** Edit a venue (`PATCH /hotels-admin/hotels/:id/venues/:venueId`). */
export function useUpdateVenue(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<
    VenueView,
    Error,
    { readonly venueId: string; readonly body: VenueUpdateRequest }
  >({
    mutationFn: ({ venueId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/venues/${venueId}`, {
        method: "PATCH",
        body,
        schema: venueView,
      }),
    onSuccess: refresh,
  });
}

/** Remove a venue (`DELETE /hotels-admin/hotels/:id/venues/:venueId`; soft delete). */
export function useDeleteVenue(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<unknown, Error, string>({
    mutationFn: (venueId) =>
      api.request(`/hotels-admin/hotels/${hotelId}/venues/${venueId}`, {
        method: "DELETE",
        schema: deletedResponse,
      }),
    onSuccess: refresh,
  });
}

/** Add a contact to a hotel (`POST /hotels-admin/hotels/:id/contacts`; RESTRICTED-CONTACT). */
export function useCreateContact(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<HotelContactView, Error, HotelContactCreateRequest>({
    mutationFn: (body) =>
      api.request(`/hotels-admin/hotels/${hotelId}/contacts`, {
        method: "POST",
        body,
        schema: hotelContactView,
      }),
    onSuccess: refresh,
  });
}

/** Edit a contact (`PATCH /hotels-admin/hotels/:id/contacts/:contactId`). */
export function useUpdateContact(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<
    HotelContactView,
    Error,
    { readonly contactId: string; readonly body: HotelContactUpdateRequest }
  >({
    mutationFn: ({ contactId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/contacts/${contactId}`, {
        method: "PATCH",
        body,
        schema: hotelContactView,
      }),
    onSuccess: refresh,
  });
}

/** Remove a contact (`DELETE /hotels-admin/hotels/:id/contacts/:contactId`; soft delete). */
export function useDeleteContact(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshHotelDetail(hotelId);
  return useMutation<unknown, Error, string>({
    mutationFn: (contactId) =>
      api.request(`/hotels-admin/hotels/${hotelId}/contacts/${contactId}`, {
        method: "DELETE",
        schema: deletedResponse,
      }),
    onSuccess: refresh,
  });
}
