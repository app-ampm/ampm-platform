import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentLinkView,
  serviceAgreementStaffPage,
  serviceAgreementStaffView,
  type DocumentLinkView,
  type ServiceAgreementCreateRequest,
  type ServiceAgreementStaffPage,
  type ServiceAgreementStaffView,
  type ServiceAgreementTransitionRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { STAFF_ENQUIRIES_QUERY_KEY, staffEnquiryQueryKey } from "./use-staff-enquiries";

/** The staff agreements path (`/crm/service-agreements`) is distinct from the client portal path. */
export const STAFF_SERVICE_AGREEMENTS_QUERY_KEY = ["crm", "service-agreements", "staff"] as const;

export interface StaffServiceAgreementsQuery {
  readonly status?: string;
  readonly hotelEnquiryId?: string;
  readonly accountId?: string;
  readonly cursor?: string;
}

/** How often the list re-reads while an agreement waits on the client, so their accept shows up. */
export const AGREEMENT_WAITING_REFRESH_MS = 20_000;

/**
 * The staff service agreements (`GET /crm/service-agreements`), filterable by enquiry / account /
 * status. Pass `enabled: false` when the signed-in role lacks the grant, so no refused request is sent.
 * While any agreement on the page is `sent` (waiting for the client to accept it in their portal) the
 * list re-reads every 20 seconds, so a staff member watching the enquiry sees the client's accept arrive
 * without reloading; with nothing waiting it does not poll.
 */
export function useStaffServiceAgreements(
  query: StaffServiceAgreementsQuery = {},
  options: { readonly enabled?: boolean } = {},
) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.hotelEnquiryId) params.set("hotelEnquiryId", query.hotelEnquiryId);
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return useQuery<ServiceAgreementStaffPage>({
    queryKey: [...STAFF_SERVICE_AGREEMENTS_QUERY_KEY, query],
    enabled: options.enabled ?? true,
    refetchInterval: (current) =>
      current.state.data?.items.some((agreement) => agreement.status === "sent")
        ? AGREEMENT_WAITING_REFRESH_MS
        : false,
    queryFn: ({ signal }) =>
      api.get(
        `/crm/service-agreements${suffix ? `?${suffix}` : ""}`,
        serviceAgreementStaffPage,
        signal,
      ),
  });
}

/** Draft a new service agreement for an enquiry (`POST /crm/service-agreements`); starts `draft`. */
export function useCreateServiceAgreement(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<ServiceAgreementStaffView, Error, ServiceAgreementCreateRequest>({
    mutationFn: (body) =>
      api.request("/crm/service-agreements", {
        method: "POST",
        body,
        schema: serviceAgreementStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_SERVICE_AGREEMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
  });
}

/**
 * Move a service agreement along its lifecycle (`PATCH /crm/service-agreements/:id/status`):
 * draft -> sent -> accepted -> active -> completed (or cancelled). Entering/leaving `active` flips the
 * account's hotel_assistance entitlement, so the enquiry is refreshed too.
 */
export function useTransitionServiceAgreement(agreementId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<ServiceAgreementStaffView, Error, ServiceAgreementTransitionRequest>({
    mutationFn: (body) =>
      api.request(`/crm/service-agreements/${agreementId}/status`, {
        method: "PATCH",
        body,
        schema: serviceAgreementStaffView,
      }),
    // Settled, not only on success: a refused move (409, the agreement moved under a stale screen —
    // the client accepted it meanwhile) re-reads the list, so the card catches up with the truth.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_SERVICE_AGREEMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
  });
}

/**
 * Record an agreement the client signed outside the app (`POST /crm/service-agreements/:id/signed-copy`,
 * the signed copy's raw bytes as octet-stream; D-135). The server types the file by content (PDF, JPEG or
 * PNG), scans it, and only then moves the agreement `sent → accepted` with the copy as its evidence.
 *
 * @example
 * const signed = useMarkAgreementSignedOffline(agreement.id, enquiryId);
 * signed.mutate({ file: picked.file });
 */
export function useMarkAgreementSignedOffline(agreementId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<ServiceAgreementStaffView, Error, { readonly file: BodyInit }>({
    mutationFn: ({ file }) =>
      api.upload(`/crm/service-agreements/${agreementId}/signed-copy`, {
        body: file,
        contentType: "application/octet-stream",
        schema: serviceAgreementStaffView,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_SERVICE_AGREEMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
    },
  });
}

/**
 * Mint a 15-minute link to an agreement's signed copy (`POST …/:id/signed-copy/link`). A mutation, not a
 * query: every mint writes a `document_access_links` row, so it runs once per "View signed copy" press.
 *
 * @example
 * const link = useAgreementSignedCopyLink(agreement.id);
 * link.mutate(undefined, { onSuccess: ({ url }) => void Linking.openURL(url) });
 */
export function useAgreementSignedCopyLink(agreementId: string) {
  const api = useApiClient();
  return useMutation<DocumentLinkView, Error, void>({
    mutationFn: async () => {
      const link = await api.request(`/crm/service-agreements/${agreementId}/signed-copy/link`, {
        method: "POST",
        schema: documentLinkView,
      });
      return { ...link, url: api.mediaUrl(link.url) ?? link.url };
    },
  });
}
