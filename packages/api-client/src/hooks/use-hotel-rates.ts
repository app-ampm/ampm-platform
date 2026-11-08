import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  rateCardView,
  rateItemView,
  verificationView,
  type RateCardCreateRequest,
  type RateCardUpdateRequest,
  type RateCardVerifyRequest,
  type RateCardView,
  type RateItemCreateRequest,
  type RateItemUpdateRequest,
  type RateItemView,
  type VerificationCreateRequest,
  type VerificationView,
} from "@ampm/core";
import { z } from "zod";

import { useApiClient } from "../provider";
import { staffHotelQueryKey } from "./use-staff-hotels";

/*
 * Staff hotel pricing (Module C, feature 9.2; AC-04): a hotel's rate cards, their rate items and the
 * verification records that let a card be published. Served under the `hotels-admin` prefix, HT/SA only
 * (`hotels.rate_cards_rate_items.*`, `hotels.verifications.*`), gated server-side. A card is CLIENT-visible
 * only when it is `verified` and an item is `client_visible`; `source`/`internalNotes` are staff-only.
 * These are separate surfaces from the staff hotel detail, so they have their own queries.
 */

/** The query key for a hotel's rate cards (nested under the hotel). */
export function rateCardsQueryKey(hotelId: string) {
  return [...staffHotelQueryKey(hotelId), "rate-cards"] as const;
}

/** The query key for a hotel's verification records. */
export function verificationsQueryKey(hotelId: string) {
  return [...staffHotelQueryKey(hotelId), "verifications"] as const;
}

const rateCardList = z.object({ items: z.array(rateCardView) }).strict();
const verificationList = z.object({ items: z.array(verificationView) }).strict();
/** Delete returns `{ id }`; the caller does not use it. */
const deletedResponse = z.unknown();

/**
 * A hotel's rate cards with their items (`GET /hotels-admin/hotels/:id/rate-cards`,
 * `hotels.rate_cards_rate_items.read`). Staff-only; the client discovery view is a separate surface.
 */
export function useHotelRateCards(hotelId: string) {
  const api = useApiClient();
  return useQuery<RateCardView[]>({
    queryKey: rateCardsQueryKey(hotelId),
    queryFn: async ({ signal }) =>
      (await api.get(`/hotels-admin/hotels/${hotelId}/rate-cards`, rateCardList, signal)).items,
  });
}

/** A hotel's verification records (`GET /hotels-admin/hotels/:id/verifications`). */
export function useHotelVerifications(hotelId: string) {
  const api = useApiClient();
  return useQuery<VerificationView[]>({
    queryKey: verificationsQueryKey(hotelId),
    queryFn: async ({ signal }) =>
      (await api.get(`/hotels-admin/hotels/${hotelId}/verifications`, verificationList, signal))
        .items,
  });
}

/** Invalidate a hotel's rate cards after any card/item/verify write. */
function useRefreshRateCards(hotelId: string): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: rateCardsQueryKey(hotelId) });
}

/** Add a rate card to a hotel (`POST …/rate-cards`). */
export function useCreateRateCard(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshRateCards(hotelId);
  return useMutation<RateCardView, Error, RateCardCreateRequest>({
    mutationFn: (body) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rate-cards`, {
        method: "POST",
        body,
        schema: rateCardView,
      }),
    onSuccess: refresh,
  });
}

/** Edit a rate card (`PATCH …/rate-cards/:cardId`). */
export function useUpdateRateCard(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshRateCards(hotelId);
  return useMutation<
    RateCardView,
    Error,
    { readonly cardId: string; readonly body: RateCardUpdateRequest }
  >({
    mutationFn: ({ cardId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}`, {
        method: "PATCH",
        body,
        schema: rateCardView,
      }),
    onSuccess: refresh,
  });
}

/** Remove a rate card (`DELETE …/rate-cards/:cardId`; soft delete). */
export function useDeleteRateCard(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshRateCards(hotelId);
  return useMutation<unknown, Error, string>({
    mutationFn: (cardId) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}`, {
        method: "DELETE",
        schema: deletedResponse,
      }),
    onSuccess: refresh,
  });
}

/** Publish a rate card against a verification record (`POST …/rate-cards/:cardId/verify`): draft/stale → verified. */
export function useVerifyRateCard(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshRateCards(hotelId);
  return useMutation<
    RateCardView,
    Error,
    { readonly cardId: string; readonly body: RateCardVerifyRequest }
  >({
    mutationFn: ({ cardId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/verify`, {
        method: "POST",
        body,
        schema: rateCardView,
      }),
    onSuccess: refresh,
  });
}

/** Add a rate item to a card (`POST …/rate-cards/:cardId/items`). */
export function useAddRateItem(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshRateCards(hotelId);
  return useMutation<
    RateItemView,
    Error,
    { readonly cardId: string; readonly body: RateItemCreateRequest }
  >({
    mutationFn: ({ cardId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items`, {
        method: "POST",
        body,
        schema: rateItemView,
      }),
    onSuccess: refresh,
  });
}

/** Edit a rate item (`PATCH …/rate-cards/:cardId/items/:itemId`). */
export function useUpdateRateItem(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshRateCards(hotelId);
  return useMutation<
    RateItemView,
    Error,
    { readonly cardId: string; readonly itemId: string; readonly body: RateItemUpdateRequest }
  >({
    mutationFn: ({ cardId, itemId, body }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items/${itemId}`, {
        method: "PATCH",
        body,
        schema: rateItemView,
      }),
    onSuccess: refresh,
  });
}

/** Remove a rate item (`DELETE …/rate-cards/:cardId/items/:itemId`; soft delete). */
export function useDeleteRateItem(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshRateCards(hotelId);
  return useMutation<unknown, Error, { readonly cardId: string; readonly itemId: string }>({
    mutationFn: ({ cardId, itemId }) =>
      api.request(`/hotels-admin/hotels/${hotelId}/rate-cards/${cardId}/items/${itemId}`, {
        method: "DELETE",
        schema: deletedResponse,
      }),
    onSuccess: refresh,
  });
}

/** Record a verification for a hotel (`POST …/verifications`); a card is verified against one. */
export function useRecordVerification(hotelId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<VerificationView, Error, VerificationCreateRequest>({
    mutationFn: (body) =>
      api.request(`/hotels-admin/hotels/${hotelId}/verifications`, {
        method: "POST",
        body,
        schema: verificationView,
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: verificationsQueryKey(hotelId) }),
  });
}
