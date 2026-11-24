import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  hotelInfoRequestDetail,
  hotelInfoRequestLinkIssued,
  type HotelInfoRequestCreateRequestInput,
  type HotelInfoRequestDetail,
  type HotelInfoRequestLinkIssued,
  type HotelInfoRequestReissueRequestInput,
  type HotelInfoRequestRevokeRequest,
  type HotelInfoRequestShareRecordRequest,
  type HotelInfoRequestUpdateRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTEL_INFO_REQUESTS_QUERY_KEY } from "./use-hotel-info-requests";

/*
 * The writes of hotel information requests, the staff side (D-188 §3): create (`hotels.info_requests
 * .create`), and reissue, record a share, edit and revoke (`…update`). Each answer is parsed by its strict
 * core schema; each success refreshes every request read (the inbox, the count to review, a hotel's
 * history and the request's detail share one prefix). The create and reissue answers carry the link,
 * shown once: those mutations keep no answer once the sheet that shows it lets go (`gcTime: 0`), and the
 * link is never put in the query cache.
 */

/** A change to one request: its id and the body the route takes. */
export interface HotelInfoRequestChange<B> {
  readonly requestId: string;
  readonly body: B;
}

/** Refreshes every request read after a write. */
function useRefreshHotelInfoRequests(): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: HOTEL_INFO_REQUESTS_QUERY_KEY });
}

/** A request route under `/hotels-admin/info-requests/:id`. */
function requestPath(requestId: string, action?: string): string {
  return `/hotels-admin/info-requests/${requestId}${action ? `/${action}` : ""}`;
}

/**
 * Create a request for an existing hotel or a proposed new one, with its link (`POST
 * /hotels-admin/info-requests`). The answer holds the request, the link once and what became of its
 * email (`queued`, `not_requested`, `mode_off`, `mode_test_only` or `failed`). A second live request is a
 * 409 whose message names its reference; `isTest` from anyone but the Super Admin is a 403.
 *
 *   const create = useCreateHotelInfoRequest();
 *   create.mutate({ target: "existing", hotelId, emailIt: true, recipientEmail }, { onSuccess: show });
 */
export function useCreateHotelInfoRequest() {
  const api = useApiClient();
  const refresh = useRefreshHotelInfoRequests();
  return useMutation<HotelInfoRequestLinkIssued, Error, HotelInfoRequestCreateRequestInput>({
    mutationFn: (body) =>
      api.request("/hotels-admin/info-requests", {
        method: "POST",
        body,
        schema: hotelInfoRequestLinkIssued,
      }),
    onSuccess: () => refresh(),
    gcTime: 0,
  });
}

/**
 * Replace a live request's link (`POST …/:id/reissue`): every copy of the old one stops working, and the
 * new one is answered once, emailed when asked. 409 when the request is no longer live, its link has
 * expired, or it changed meanwhile.
 *
 *   const reissue = useReissueHotelInfoRequest();
 *   reissue.mutate({ requestId, body: { emailIt: false } });
 */
export function useReissueHotelInfoRequest() {
  const api = useApiClient();
  const refresh = useRefreshHotelInfoRequests();
  return useMutation<
    HotelInfoRequestLinkIssued,
    Error,
    HotelInfoRequestChange<HotelInfoRequestReissueRequestInput>
  >({
    mutationFn: ({ requestId, body }) =>
      api.request(requestPath(requestId, "reissue"), {
        method: "POST",
        body,
        schema: hotelInfoRequestLinkIssued,
      }),
    onSuccess: () => refresh(),
    gcTime: 0,
  });
}

/**
 * Record that staff passed the link on by hand, and how (`POST …/:id/share-record`): WhatsApp, a copy or
 * another way. The link itself is never sent.
 *
 *   const record = useRecordHotelInfoRequestShare();
 *   record.mutate({ requestId, body: { channel: "copy" } });
 */
export function useRecordHotelInfoRequestShare() {
  const api = useApiClient();
  const refresh = useRefreshHotelInfoRequests();
  return useMutation<
    HotelInfoRequestDetail,
    Error,
    HotelInfoRequestChange<HotelInfoRequestShareRecordRequest>
  >({
    mutationFn: ({ requestId, body }) =>
      api.request(requestPath(requestId, "share-record"), {
        method: "POST",
        body,
        schema: hotelInfoRequestDetail,
      }),
    onSuccess: () => refresh(),
  });
}

/**
 * Edit a live request's label, note or recipient (null clears one), or extend its link by days or to a
 * date (`PATCH …/:id`); a 400 past `maxExtensionDays` names the latest date allowed.
 *
 *   const update = useUpdateHotelInfoRequest();
 *   update.mutate({ requestId, body: { extendDays: 14 } });
 */
export function useUpdateHotelInfoRequest() {
  const api = useApiClient();
  const refresh = useRefreshHotelInfoRequests();
  return useMutation<
    HotelInfoRequestDetail,
    Error,
    HotelInfoRequestChange<HotelInfoRequestUpdateRequest>
  >({
    mutationFn: ({ requestId, body }) =>
      api.request(requestPath(requestId), {
        method: "PATCH",
        body,
        schema: hotelInfoRequestDetail,
      }),
    onSuccess: () => refresh(),
  });
}

/**
 * Revoke an open or changes-requested request, with the reason (`POST …/:id/revoke`): its link stops
 * working. 409 for a submitted, in-review or finished request.
 *
 *   const revoke = useRevokeHotelInfoRequest();
 *   revoke.mutate({ requestId, body: { reason: "Sent to the wrong hotel" } });
 */
export function useRevokeHotelInfoRequest() {
  const api = useApiClient();
  const refresh = useRefreshHotelInfoRequests();
  return useMutation<
    HotelInfoRequestDetail,
    Error,
    HotelInfoRequestChange<HotelInfoRequestRevokeRequest>
  >({
    mutationFn: ({ requestId, body }) =>
      api.request(requestPath(requestId, "revoke"), {
        method: "POST",
        body,
        schema: hotelInfoRequestDetail,
      }),
    onSuccess: () => refresh(),
  });
}
