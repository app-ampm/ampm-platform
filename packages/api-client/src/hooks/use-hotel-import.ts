import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hotelImportResult, type HotelImportKind, type HotelImportResult } from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTEL_MEDIA_QUERY_KEY } from "./use-hotel-media";
import { STAFF_DESTINATIONS_QUERY_KEY, STAFF_HOTELS_QUERY_KEY } from "./use-staff-hotels";

/** One preview of an import: its kind and the CSV text as the file holds it. */
export interface HotelImportPreviewInput {
  readonly kind: HotelImportKind;
  readonly csv: string;
}

/** One import of a preview: its kind and the preview's `importJobId`. */
export interface HotelImportApplyInput {
  readonly kind: HotelImportKind;
  readonly jobId: string;
}

/**
 * The address a kind's file is previewed at. Every upload is a preview, so it carries no query.
 *
 * @example
 * hotelImportPreviewPath("rooms"); // "/hotels-admin/imports/rooms"
 */
export function hotelImportPreviewPath(kind: HotelImportKind): string {
  return `/hotels-admin/imports/${kind}`;
}

/**
 * The address that imports a kind's preview, by the preview's job id.
 *
 * @example
 * hotelImportApplyPath("venues", jobId); // "/hotels-admin/imports/venues/<jobId>/apply"
 */
export function hotelImportApplyPath(kind: HotelImportKind, jobId: string): string {
  return `/hotels-admin/imports/${kind}/${encodeURIComponent(jobId)}/apply`;
}

/**
 * Preview an import of the hotels, rooms or venues template (`POST /hotels-admin/imports/<kind>`, the
 * kind's create key; TW-25, D-181). The file goes up as raw bytes (`application/octet-stream`), never as
 * JSON, so the server reads it only after its guards and it may reach the 5 MB cap. A preview reports
 * each row (create, update with the fields it changes, unchanged or error) and writes nothing but its
 * job, so nothing refreshes; its `importJobId` is what {@link useHotelImportApply} imports.
 *
 *   const preview = useHotelImportPreview();
 *   preview.mutate({ kind: "rooms", csv });
 */
export function useHotelImportPreview() {
  const api = useApiClient();
  return useMutation<HotelImportResult, Error, HotelImportPreviewInput>({
    mutationFn: ({ kind, csv }) =>
      api.upload(hotelImportPreviewPath(kind), {
        body: csv,
        contentType: "application/octet-stream",
        schema: hotelImportResult,
      }),
  });
}

/**
 * Import a preview by its job id (`POST /hotels-admin/imports/<kind>/:jobId/apply`, body `{}`). The
 * server applies the rows it planned, refusing any whose target changed since, and answers with the same
 * `importJobId`; a job that is not the caller's preview of this kind is a 404, and one already imported
 * or expired a 409. When anything was written (`applied`) the staff catalogue refreshes, every open staff
 * hotel detail with it (their keys share its prefix, so the rooms and venues nested in a detail reload),
 * and the destinations (a hotels import may add one, and each counts its hotels); so do the hotels'
 * media lists when it registered images.
 *
 *   const apply = useHotelImportApply();
 *   apply.mutate({ kind: "rooms", jobId: preview.importJobId });
 */
export function useHotelImportApply() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelImportResult, Error, HotelImportApplyInput>({
    mutationFn: ({ kind, jobId }) =>
      api.request(hotelImportApplyPath(kind, jobId), {
        method: "POST",
        body: {},
        schema: hotelImportResult,
      }),
    onSuccess: (result) => {
      if (!result.applied) return;
      void queryClient.invalidateQueries({ queryKey: STAFF_HOTELS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: STAFF_DESTINATIONS_QUERY_KEY });
      if (result.mediaRegistered > 0) {
        void queryClient.invalidateQueries({ queryKey: HOTEL_MEDIA_QUERY_KEY });
      }
    },
  });
}
