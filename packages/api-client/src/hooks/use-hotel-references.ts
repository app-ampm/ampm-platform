import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentLinkView,
  weddingReferenceView,
  type DocumentLinkView,
  type WeddingReferenceCreateRequest,
  type WeddingReferenceUpdateRequest,
  type WeddingReferenceView,
} from "@ampm/core";
import { z } from "zod";

import { useApiClient } from "../provider";
import { staffHotelQueryKey } from "./use-staff-hotels";

/*
 * Staff previous-wedding references (Module C, feature 9.3; TW-22's References tab): weddings held at a
 * hotel, shown to clients as social proof once the couple's consent is on file and staff choose to show
 * them (GP-20). Served under `hotels-admin` (`hotels.wedding_references.*`: read SA/SM/HT/PM, write
 * SA/HT), gated server-side. Consent arrives only by upload, never as an id the client supplies.
 */

/** The query key for a hotel's wedding references (nested under the hotel). */
export function weddingReferencesQueryKey(hotelId: string) {
  return [...staffHotelQueryKey(hotelId), "wedding-references"] as const;
}

const referenceList = z.object({ items: z.array(weddingReferenceView) }).strict();
/** Delete returns `{ id }`; the caller does not use it. */
const deletedResponse = z.unknown();

const referencesPath = (hotelId: string) => `/hotels-admin/hotels/${hotelId}/wedding-references`;

function useRefreshReferences(hotelId: string): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: weddingReferencesQueryKey(hotelId) });
}

/**
 * A hotel's previous-wedding references, newest wedding first
 * (`GET /hotels-admin/hotels/:id/wedding-references`). The staff view carries the consent state.
 *
 * @example
 * const references = useHotelReferences(hotelId);
 */
export function useHotelReferences(hotelId: string) {
  const api = useApiClient();
  return useQuery<WeddingReferenceView[]>({
    queryKey: weddingReferencesQueryKey(hotelId),
    queryFn: async ({ signal }) =>
      (await api.get(referencesPath(hotelId), referenceList, signal)).items,
    enabled: Boolean(hotelId),
  });
}

/** Add a reference (`POST …/wedding-references`); it starts internal, with no consent. */
export function useCreateHotelReference(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshReferences(hotelId);
  return useMutation<WeddingReferenceView, Error, WeddingReferenceCreateRequest>({
    mutationFn: (body) =>
      api.request(referencesPath(hotelId), {
        method: "POST",
        body,
        schema: weddingReferenceView,
      }),
    onSuccess: refresh,
  });
}

/**
 * Edit a reference or show / hide it to clients (`PATCH …/wedding-references/:id`). Showing it needs the
 * consent on file: the server answers 409 otherwise (GP-20).
 */
export function useUpdateHotelReference(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshReferences(hotelId);
  return useMutation<
    WeddingReferenceView,
    Error,
    { readonly referenceId: string; readonly body: WeddingReferenceUpdateRequest }
  >({
    mutationFn: ({ referenceId, body }) =>
      api.request(`${referencesPath(hotelId)}/${referenceId}`, {
        method: "PATCH",
        body,
        schema: weddingReferenceView,
      }),
    onSuccess: refresh,
  });
}

/** Remove a reference (`DELETE …/wedding-references/:id`; soft delete, audited). */
export function useDeleteHotelReference(hotelId: string) {
  const api = useApiClient();
  const refresh = useRefreshReferences(hotelId);
  return useMutation<unknown, Error, string>({
    mutationFn: (referenceId) =>
      api.request(`${referencesPath(hotelId)}/${referenceId}`, {
        method: "DELETE",
        schema: deletedResponse,
      }),
    onSuccess: refresh,
  });
}

/**
 * Upload the couple's consent to a reference (`POST …/wedding-references/:id/consent`, the raw bytes as
 * octet-stream). The server types the file by content (PDF, JPEG or PNG), scans it, and files a
 * replacement as the next version. Attaching never shows the reference to clients by itself.
 *
 * @example
 * const attach = useAttachReferenceConsent(hotelId, reference.id);
 * attach.mutate({ file: picked.file });
 */
export function useAttachReferenceConsent(hotelId: string, referenceId: string) {
  const api = useApiClient();
  const refresh = useRefreshReferences(hotelId);
  return useMutation<WeddingReferenceView, Error, { readonly file: BodyInit }>({
    mutationFn: ({ file }) =>
      api.upload(`${referencesPath(hotelId)}/${referenceId}/consent`, {
        body: file,
        contentType: "application/octet-stream",
        schema: weddingReferenceView,
      }),
    onSuccess: refresh,
  });
}

/**
 * Mint a 15-minute link to a reference's consent document (`POST …/:id/consent/link`). A mutation, not a
 * query: every mint writes a `document_access_links` row, so it runs once per "View consent" press. Only
 * a role that may update references (SA/HT) mints one; SM and PM read references but answer 403 here. The
 * link comes back resolved against the API base, ready to open.
 *
 * @example
 * const link = useReferenceConsentLink(hotelId, reference.id);
 * link.mutate(undefined, { onSuccess: ({ url }) => void Linking.openURL(url) });
 */
export function useReferenceConsentLink(hotelId: string, referenceId: string) {
  const api = useApiClient();
  return useMutation<DocumentLinkView, Error, void>({
    mutationFn: async () => {
      const link = await api.request(`${referencesPath(hotelId)}/${referenceId}/consent/link`, {
        method: "POST",
        schema: documentLinkView,
      });
      return { ...link, url: api.mediaUrl(link.url) ?? link.url };
    },
  });
}
