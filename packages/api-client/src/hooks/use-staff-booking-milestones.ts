import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bookingMilestoneStaffPage,
  bookingMilestoneStaffView,
  documentLinkView,
  type BookingMilestoneCreateRequest,
  type BookingMilestoneStaffPage,
  type BookingMilestoneStaffView,
  type BookingMilestoneTransitionRequest,
  type DocumentLinkView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { staffEnquiryQueryKey } from "./use-staff-enquiries";

export const STAFF_MILESTONES_QUERY_KEY = ["consultancy-admin", "booking-milestones"] as const;

export function staffMilestonesQueryKey(enquiryId: string) {
  return [...STAFF_MILESTONES_QUERY_KEY, { enquiryId }] as const;
}

/** The staff booking milestones for an enquiry (`GET /consultancy-admin/booking-milestones?enquiryId=`);
 *  the amount is always present for staff (the client sees it only behind the W-14 flag). */
export function useStaffBookingMilestones(enquiryId: string) {
  const api = useApiClient();
  return useQuery<BookingMilestoneStaffPage>({
    queryKey: staffMilestonesQueryKey(enquiryId),
    queryFn: ({ signal }) =>
      api.get(
        `/consultancy-admin/booking-milestones?enquiryId=${enquiryId}`,
        bookingMilestoneStaffPage,
        signal,
      ),
    enabled: Boolean(enquiryId),
  });
}

/** Add a milestone to an enquiry (`POST /consultancy-admin/booking-milestones`); starts `pending`. */
export function useCreateBookingMilestone(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<BookingMilestoneStaffView, Error, BookingMilestoneCreateRequest>({
    mutationFn: (body) =>
      api.request("/consultancy-admin/booking-milestones", {
        method: "POST",
        body,
        schema: bookingMilestoneStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffMilestonesQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
    },
  });
}

/** Mark a milestone done or cancelled (`PATCH /consultancy-admin/booking-milestones/:id/status`); overdue
 *  is worker-only, so the UI offers only done/cancelled from a pending milestone. */
export function useTransitionBookingMilestone(milestoneId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<BookingMilestoneStaffView, Error, BookingMilestoneTransitionRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy-admin/booking-milestones/${milestoneId}/status`, {
        method: "PATCH",
        body,
        schema: bookingMilestoneStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffMilestonesQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
    },
  });
}

/**
 * Attach the signed contract to a `contract_signed` milestone (`POST
 * /consultancy-admin/booking-milestones/:id/contract`, the raw bytes as octet-stream; D-132). The server
 * types the file by content (PDF, JPEG or PNG), scans it, and files a replacement as the next version;
 * only then can the milestone be marked done, which the enquiry's confirmed-guard needs.
 *
 * @example
 * const attach = useAttachMilestoneContract(milestone.id, enquiryId);
 * attach.mutate({ file: picked.file });
 */
export function useAttachMilestoneContract(milestoneId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<BookingMilestoneStaffView, Error, { readonly file: BodyInit }>({
    mutationFn: ({ file }) =>
      api.upload(`/consultancy-admin/booking-milestones/${milestoneId}/contract`, {
        body: file,
        contentType: "application/octet-stream",
        schema: bookingMilestoneStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffMilestonesQueryKey(enquiryId) });
    },
  });
}

/**
 * Mint a 15-minute link to a milestone's signed contract (`POST …/:id/contract/link`). A mutation, not a
 * query: every mint writes a `document_access_links` row, so it runs once per "View contract" press and
 * never on render or refetch. The link comes back resolved against the API base, ready to open.
 *
 * @example
 * const link = useMilestoneContractLink(milestone.id);
 * link.mutate(undefined, { onSuccess: ({ url }) => void Linking.openURL(url) });
 */
export function useMilestoneContractLink(milestoneId: string) {
  const api = useApiClient();
  return useMutation<DocumentLinkView, Error, void>({
    mutationFn: async () => {
      const link = await api.request(
        `/consultancy-admin/booking-milestones/${milestoneId}/contract/link`,
        { method: "POST", schema: documentLinkView },
      );
      return { ...link, url: api.mediaUrl(link.url) ?? link.url };
    },
  });
}
