import { useQuery } from "@tanstack/react-query";
import {
  hotelDuplicateHints,
  hotelFormModeView,
  hotelInfoRequestDetail,
  hotelInfoRequestPage,
  type HotelDuplicateHints,
  type HotelDuplicateHintsQuery,
  type HotelFormMode,
  type HotelInfoRequestDetail,
  type HotelInfoRequestKind,
  type HotelInfoRequestStatus,
  type HotelInfoRequestSummaryView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList, type CursorListOptions } from "./use-cursor-list";

/*
 * The reads of hotel information requests, the staff side (D-188 §3 and §7; `hotels.info_requests.read`
 * unless named): the inbox (TW-99) and a hotel's history by cursor, one request in the caller's model,
 * the count of requests to review, the hotel form's mode, and the Invite sheet's duplicate hints. Every
 * answer is parsed by its strict core schema, so a field the contract does not name (the link, its hash)
 * is refused rather than shown. The writes are in use-hotel-info-request-actions.ts.
 */

/** The prefix of every request read: a write refreshes them all. */
export const HOTEL_INFO_REQUESTS_QUERY_KEY = ["hotels-admin", "info-requests"] as const;
export const HOTEL_FORM_MODE_QUERY_KEY = ["hotels-admin", "hotel-form-mode"] as const;
const HOTEL_DUPLICATE_HINTS_QUERY_KEY = ["hotels-admin", "hotel-duplicate-hints"] as const;

/** The key of one request's detail. */
export function hotelInfoRequestQueryKey(requestId: string) {
  return [...HOTEL_INFO_REQUESTS_QUERY_KEY, "request", requestId] as const;
}

/** The key of one hotel's requests. */
export function hotelInfoRequestHistoryQueryKey(hotelId: string) {
  return [...HOTEL_INFO_REQUESTS_QUERY_KEY, "hotel", hotelId] as const;
}

/** What the inbox is filtered by, and the page it asks for. */
export interface HotelInfoRequestsQuery {
  readonly status?: HotelInfoRequestStatus | undefined;
  readonly kind?: HotelInfoRequestKind | undefined;
  /** Test requests are left out unless this is true (the API's default). */
  readonly includeTests?: boolean | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
}

/**
 * The inbox's path: an unset filter is left out, and tests are named only when wanted.
 *
 * @example
 * hotelInfoRequestsPath({ status: "submitted" }); // "/hotels-admin/info-requests?status=submitted"
 */
export function hotelInfoRequestsPath(query: HotelInfoRequestsQuery): string {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.status) params.set("status", query.status);
  if (query.kind) params.set("kind", query.kind);
  if (query.includeTests) params.set("includeTests", "true");
  const search = params.toString();
  return `/hotels-admin/info-requests${search ? `?${search}` : ""}`;
}

/**
 * The inbox (TW-99): summaries, newest first, 50 a page, by cursor ({@link useCursorList}).
 *
 *   const requests = useHotelInfoRequests({ status: "submitted" }, { keepPreviousData: true });
 */
export function useHotelInfoRequests(
  query: Omit<HotelInfoRequestsQuery, "cursor"> = {},
  options: CursorListOptions = {},
) {
  const api = useApiClient();
  return useCursorList<HotelInfoRequestSummaryView>(
    [...HOTEL_INFO_REQUESTS_QUERY_KEY, "inbox", query],
    (cursor, signal) =>
      api.get(hotelInfoRequestsPath({ ...query, cursor }), hotelInfoRequestPage, signal),
    options,
  );
}

/** How many requests wait for the Hotel team's review. */
export interface HotelInfoRequestsToReview {
  /** Submitted and in-review requests, tests left out. */
  readonly count: number;
  /** More than a page of either status waits beyond the count: show it with a "+". */
  readonly isCapped: boolean;
}

const TO_REVIEW: readonly HotelInfoRequestStatus[] = ["submitted", "in_review"];
const TO_REVIEW_PAGE = 100;

/**
 * The count the hotels list shows ("Requests · 3 to review"): the first hundred of each status the
 * review takes, tests left out. Pass `enabled: false` for a role that may not read requests.
 *
 *   const toReview = useHotelInfoRequestsToReview({ enabled: canRead });
 */
export function useHotelInfoRequestsToReview({
  enabled = true,
}: { readonly enabled?: boolean } = {}) {
  const api = useApiClient();
  return useQuery<HotelInfoRequestsToReview>({
    queryKey: [...HOTEL_INFO_REQUESTS_QUERY_KEY, "to-review"],
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        TO_REVIEW.map((status) =>
          api.get(
            hotelInfoRequestsPath({ status, limit: TO_REVIEW_PAGE }),
            hotelInfoRequestPage,
            signal,
          ),
        ),
      );
      return {
        count: pages.reduce((total, page) => total + page.items.length, 0),
        isCapped: pages.some((page) => page.nextCursor !== null),
      };
    },
    enabled,
  });
}

/**
 * One hotel's requests, newest first, tests included, by cursor: the hotel record's request panel reads
 * the live one, or the latest.
 *
 *   const history = useHotelInfoRequestHistory(hotelId, { enabled: canRead });
 */
export function useHotelInfoRequestHistory(hotelId: string, options: CursorListOptions = {}) {
  const api = useApiClient();
  return useCursorList<HotelInfoRequestSummaryView>(
    hotelInfoRequestHistoryQueryKey(hotelId),
    (cursor, signal) =>
      api.get(
        `/hotels-admin/hotels/${hotelId}/info-requests${cursor ? `?cursor=${cursor}` : ""}`,
        hotelInfoRequestPage,
        signal,
      ),
    options,
  );
}

/**
 * One request in the caller's model: the full view, with the recipient and the latest events, for a
 * holder of `hotels.info_requests.update`; the summary for every other reader. Narrow with
 * `"events" in request`. Waits while `requestId` is null.
 *
 *   const request = useHotelInfoRequest(live?.id ?? null);
 */
export function useHotelInfoRequest(
  requestId: string | null,
  { enabled = true }: { readonly enabled?: boolean } = {},
) {
  const api = useApiClient();
  return useQuery<HotelInfoRequestDetail>({
    queryKey: hotelInfoRequestQueryKey(requestId ?? ""),
    queryFn: ({ signal }) =>
      api.get(`/hotels-admin/info-requests/${requestId ?? ""}`, hotelInfoRequestDetail, signal),
    enabled: enabled && requestId !== null,
  });
}

/**
 * The hotel form's mode (`GET /hotels-admin/hotel-form-mode`), which decides whether "Email it" reaches
 * the hotel: read afresh each time a sheet opens (the API reads it past its own cache too), never from
 * the client's 30-second one.
 *
 *   const mode = useHotelFormMode({ enabled: open }); // mode.data: "off" | "test_only" | "on"
 */
export function useHotelFormMode({ enabled = true }: { readonly enabled?: boolean } = {}) {
  const api = useApiClient();
  return useQuery<HotelFormMode>({
    queryKey: HOTEL_FORM_MODE_QUERY_KEY,
    queryFn: async ({ signal }) =>
      (await api.get("/hotels-admin/hotel-form-mode", hotelFormModeView, signal)).mode,
    enabled,
    staleTime: 0,
  });
}

/** The fewest characters of a name or an address worth checking. */
const HINTS_MIN_CHARS = 3;

/**
 * The duplicate hints' path: what was typed, trimmed, and the destination chosen; a blank is left out.
 *
 * @example
 * hotelDuplicateHintsPath({ name: "Lake Palace" }); // "/hotels-admin/hotel-duplicate-hints?name=Lake+Palace"
 */
export function hotelDuplicateHintsPath(query: HotelDuplicateHintsQuery): string {
  const params = new URLSearchParams();
  const name = query.name?.trim() ?? "";
  const webAddress = query.webAddress?.trim() ?? "";
  if (name) params.set("name", name);
  if (webAddress) params.set("webAddress", webAddress);
  if (query.destinationId) params.set("destinationId", query.destinationId);
  const search = params.toString();
  return `/hotels-admin/hotel-duplicate-hints${search ? `?${search}` : ""}`;
}

/** The duplicate hints as the Invite sheet reads them: the live requests are none when none were asked. */
export type HotelDuplicateHintsFound = Required<HotelDuplicateHints>;

/**
 * The catalogue hotels a proposed new hotel may already be (`hotels.info_requests.create`), strongest
 * first, deleted ones included; and, with the destination chosen, the live new-hotel requests of the same
 * name there (D-192). Pass the typed values after a debounce (`useDebouncedValue`); nothing is asked
 * until a name or an address has three characters, and the last hints stay while a refined one loads.
 *
 *   const hints = useHotelDuplicateHints({ name: debouncedName, webAddress, destinationId });
 */
export function useHotelDuplicateHints(
  query: HotelDuplicateHintsQuery,
  { enabled = true }: { readonly enabled?: boolean } = {},
) {
  const api = useApiClient();
  const name = query.name?.trim() ?? "";
  const webAddress = query.webAddress?.trim() ?? "";
  const destinationId = query.destinationId ?? "";
  const ready = enabled && (name.length >= HINTS_MIN_CHARS || webAddress.length >= HINTS_MIN_CHARS);
  return useQuery<HotelDuplicateHintsFound>({
    queryKey: [...HOTEL_DUPLICATE_HINTS_QUERY_KEY, { name, webAddress, destinationId }],
    queryFn: async ({ signal }) => {
      const path = hotelDuplicateHintsPath({ name, webAddress, destinationId });
      const answer = await api.get(path, hotelDuplicateHints, signal);
      return { hints: answer.hints, liveRequests: answer.liveRequests ?? [] };
    },
    enabled: ready,
    placeholderData: (previous) => (ready ? previous : undefined),
  });
}
