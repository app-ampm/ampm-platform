import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentLinkView,
  hotelDocumentList,
  hotelDocumentRemovedResponse,
  hotelDocumentView,
  isAppError,
  type DocumentLinkView,
  type HotelDocumentRemovedResponse,
  type HotelDocumentUploadQueryInput,
  type HotelDocumentView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { staffHotelQueryKey } from "./use-staff-hotels";

/*
 * A hotel's documents library (D-187 §6; the staff hotel record's Documents tab): the fact sheets, food
 * and beverage menus, floor plans and other files a hotel sends, each with its earlier versions. Every
 * document is INTERNAL; the routes are keyed `hotels.hotel_documents.*` (read SA/SM/HT/PM, write SA/HT,
 * a replacement also needs the update key), gated server-side, and a role without the read key gets a
 * 404. Every response is parsed through its strict @ampm/core schema, so a field the contract does not
 * name (a storage key, a checksum) is refused rather than kept.
 */

/** The query key for a hotel's documents (nested under the hotel). */
export function hotelDocumentsQueryKey(hotelId: string) {
  return [...staffHotelQueryKey(hotelId), "documents"] as const;
}

const documentsPath = (hotelId: string) => `/hotels-admin/hotels/${hotelId}/documents`;

/**
 * Where an upload goes: the documents route with the type, the title when one is given (trimmed; a
 * blank one is left out, so the API names a new document after its type and a replacement keeps its
 * document's title) and the document a replacement follows. The file itself is the request's body,
 * never part of the query.
 *
 * @example
 * hotelDocumentUploadPath(hotelId, { type: "menu", title: "Banquet menu" });
 * // "/hotels-admin/hotels/<hotelId>/documents?type=menu&title=Banquet+menu"
 */
export function hotelDocumentUploadPath(
  hotelId: string,
  query: HotelDocumentUploadQueryInput,
): string {
  const params = new URLSearchParams({ type: query.type });
  const title = query.title?.trim();
  if (title) params.set("title", title);
  if (query.replaces) params.set("replaces", query.replaces);
  return `${documentsPath(hotelId)}?${params.toString()}`;
}

/**
 * Refreshing the hotel's documents: after any write that landed, and after a refusal that means the list
 * on screen is out of date: a newer version was filed since (409) or the document is gone (404).
 */
function useDocumentsRefresh(hotelId: string) {
  const queryClient = useQueryClient();
  const refresh = (): void =>
    void queryClient.invalidateQueries({ queryKey: hotelDocumentsQueryKey(hotelId) });
  const refreshIfStale = (error: Error): void => {
    if (isAppError(error) && (error.code === "conflict" || error.code === "not_found")) refresh();
  };
  return { refresh, refreshIfStale };
}

/**
 * A hotel's live documents (`GET /hotels-admin/hotels/:hotelId/documents`), ordered by type (fact sheet,
 * food menu, beverage menu, floor plan, other) and then newest first, each with its earlier versions.
 *
 * @example
 * const documents = useHotelDocuments(hotelId);
 */
export function useHotelDocuments(hotelId: string) {
  const api = useApiClient();
  return useQuery<HotelDocumentView[]>({
    queryKey: hotelDocumentsQueryKey(hotelId),
    queryFn: async ({ signal }) =>
      (await api.get(documentsPath(hotelId), hotelDocumentList, signal)).items,
    enabled: Boolean(hotelId),
  });
}

/** One upload: the query (type, optional title, the document it replaces) and the file's bytes. */
export interface HotelDocumentUploadInput extends HotelDocumentUploadQueryInput {
  /** The raw bytes (a File or Blob on web). */
  readonly file: BodyInit;
}

/**
 * Upload a document, or a new version of one (`POST …/documents?type=&title=&replaces=`, the file as raw
 * `application/octet-stream`). The server types the bytes by content and refuses a file its type does
 * not take: 415 for a kind the type does not take (Word included), 400 for anything refused inside one,
 * each with its message on `file`; 413 over the cap, 409 at 100 documents or when `replaces` is no
 * longer the latest version, and 503 with `Retry-After` while the server is busy with other uploads.
 *
 * @example
 * const upload = useUploadHotelDocument(hotelId);
 * upload.mutate({ type: "menu", title: "Banquet menu", file: picked.file });
 */
export function useUploadHotelDocument(hotelId: string) {
  const api = useApiClient();
  const { refresh, refreshIfStale } = useDocumentsRefresh(hotelId);
  return useMutation<HotelDocumentView, Error, HotelDocumentUploadInput>({
    mutationFn: ({ file, ...query }) =>
      api.upload(hotelDocumentUploadPath(hotelId, query), {
        body: file,
        contentType: "application/octet-stream",
        schema: hotelDocumentView,
      }),
    onSuccess: refresh,
    onError: refreshIfStale,
  });
}

/**
 * Delete a document with every version of it (`DELETE …/documents/:documentId`, named by its latest
 * version; a soft delete, audited). An earlier version's id is answered 409.
 *
 * @example
 * const remove = useDeleteHotelDocument(hotelId);
 * remove.mutate(document.id);
 */
export function useDeleteHotelDocument(hotelId: string) {
  const api = useApiClient();
  const { refresh, refreshIfStale } = useDocumentsRefresh(hotelId);
  return useMutation<HotelDocumentRemovedResponse, Error, string>({
    mutationFn: (documentId) =>
      api.request(`${documentsPath(hotelId)}/${documentId}`, {
        method: "DELETE",
        schema: hotelDocumentRemovedResponse,
      }),
    onSuccess: refresh,
    onError: refreshIfStale,
  });
}

/**
 * Mint a 15-minute link to one version of a document (`POST …/documents/:documentId/link`), any live
 * version. A mutation, not a query: every mint writes a `document_access_links` row, so it runs once per
 * press. The link comes back resolved against the API base, ready to open.
 *
 * @example
 * const link = useHotelDocumentLink(hotelId);
 * link.mutate(version.id, { onSuccess: ({ url }) => void Linking.openURL(url) });
 */
export function useHotelDocumentLink(hotelId: string) {
  const api = useApiClient();
  const { refreshIfStale } = useDocumentsRefresh(hotelId);
  return useMutation<DocumentLinkView, Error, string>({
    mutationFn: async (documentId) => {
      const link = await api.request(`${documentsPath(hotelId)}/${documentId}/link`, {
        method: "POST",
        schema: documentLinkView,
      });
      return { ...link, url: api.mediaUrl(link.url) ?? link.url };
    },
    onError: refreshIfStale,
  });
}
