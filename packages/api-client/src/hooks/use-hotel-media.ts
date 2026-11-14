import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  mediaAssetPage,
  mediaAssetView,
  mediaDownloadUrl,
  mediaRemovedResponse,
  type MediaAssetPage,
  type MediaAssetUpdateRequest,
  type MediaAssetView,
  type MediaDownloadUrl,
  type MediaKind,
  type MediaRemovedResponse,
  type MediaRightsStatus,
  type MediaVariant,
  type MediaVisibility,
} from "@ampm/core";

import { useApiClient } from "../provider";

/** The query key for one hotel's media list. */
export function hotelMediaQueryKey(hotelId: string) {
  return ["media", "hotel", hotelId] as const;
}

/**
 * One hotel's media assets as staff see them (`GET /media?ownerType=hotel&ownerId=`,
 * `hotels.hotel_media_rights_status.read`): every photo with its scan state, visibility and rights,
 * cursor-paginated. Staff-only, gated server-side.
 */
export function useHotelMedia(hotelId: string) {
  const api = useApiClient();
  return useQuery<MediaAssetPage>({
    queryKey: hotelMediaQueryKey(hotelId),
    queryFn: ({ signal }) =>
      api.get(`/media?ownerType=hotel&ownerId=${hotelId}`, mediaAssetPage, signal),
  });
}

export interface AddHotelMediaInput {
  /** The raw file bytes (a File/Blob on web). */
  readonly file: BodyInit;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** image or video: the registered kind. The server verifies it against the bytes' content (AC-20.2). */
  readonly kind: MediaKind;
  /** Detail set at creation (the add sheet collects these); an omitted field takes the server's default. */
  readonly caption?: string | null;
  readonly visibility?: MediaVisibility;
  readonly rightsStatus?: MediaRightsStatus;
}

/**
 * Add a photo or video to a hotel: register the asset (`POST /media`), then upload its raw bytes
 * (`POST /media/:id/upload`, octet-stream). The server sniffs the bytes fail-closed; an image also gets its
 * web/thumbnail derivatives while a video keeps only its original (feature 9.3c) — either way the result
 * carries the final `scanStatus`. Caption, visibility and rights may be set at creation, or left to the
 * server defaults (`internal` / `consent_required`) and changed later with {@link useUpdateMedia}; the GP-20
 * gate (client visibility needs cleared rights) is server-enforced either way. Refreshes the media list.
 */
export function useAddHotelMedia(hotelId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<MediaAssetView, Error, AddHotelMediaInput>({
    mutationFn: async ({ file, mimeType, sizeBytes, kind, caption, visibility, rightsStatus }) => {
      const asset = await api.request("/media", {
        method: "POST",
        body: {
          ownerType: "hotel",
          ownerId: hotelId,
          kind,
          mimeType,
          sizeBytes,
          ...(caption !== undefined ? { caption } : {}),
          ...(visibility !== undefined ? { visibility } : {}),
          ...(rightsStatus !== undefined ? { rightsStatus } : {}),
        },
        schema: mediaAssetView,
      });
      try {
        return await api.upload(`/media/${asset.id}/upload`, {
          body: file,
          contentType: "application/octet-stream",
          schema: mediaAssetView,
        });
      } catch (error) {
        // The register succeeded but the bytes never landed: soft-delete the pending placeholder so a
        // retry does not pile up orphaned "Scanning" rows in the staff list (best effort).
        await api
          .request(`/media/${asset.id}`, { method: "DELETE", schema: mediaRemovedResponse })
          .catch(() => undefined);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelMediaQueryKey(hotelId) });
    },
  });
}

/**
 * Change a photo's caption, order, visibility or rights (`PATCH /media/:id`,
 * `hotels.hotel_media_rights_status.update`). Setting visibility to client/demo/public needs a cleared
 * rights status (GP-20, server-enforced). Refreshes the hotel's media list.
 */
export function useUpdateMedia(hotelId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    MediaAssetView,
    Error,
    { readonly mediaId: string; readonly body: MediaAssetUpdateRequest }
  >({
    mutationFn: ({ mediaId, body }) =>
      api.request(`/media/${mediaId}`, { method: "PATCH", body, schema: mediaAssetView }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelMediaQueryKey(hotelId) });
    },
  });
}

/** Remove a photo from a hotel (`DELETE /media/:id`); the hotel's media list refreshes. */
export function useDeleteMedia(hotelId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<MediaRemovedResponse, Error, string>({
    mutationFn: (mediaId) =>
      api.request(`/media/${mediaId}`, { method: "DELETE", schema: mediaRemovedResponse }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelMediaQueryKey(hotelId) });
    },
  });
}

/**
 * A short-lived signed URL for one media rendition (`GET /media/:id/download-url?variant=`,
 * `hotels.hotel_media_rights_status.read`) — the staff gallery's preview source. Minted only for a
 * `clean` asset, so pass `enabled` false until the scan has passed.
 */
export function useMediaDownloadUrl(mediaId: string, variant: MediaVariant, enabled: boolean) {
  const api = useApiClient();
  return useQuery<MediaDownloadUrl>({
    queryKey: ["media", mediaId, "download-url", variant],
    enabled,
    queryFn: ({ signal }) =>
      api.get(`/media/${mediaId}/download-url?variant=${variant}`, mediaDownloadUrl, signal),
  });
}
