import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hotelEnquiryStaffDetailView,
  hotelEnquiryStaffPage,
  hotelEnquiryStaffView,
  type HotelEnquiryStaffDetailView,
  type HotelEnquiryStaffPage,
  type HotelEnquiryStaffView,
  type HotelEnquiryStatusUpdateRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";

export const STAFF_ENQUIRIES_QUERY_KEY = ["consultancy-admin", "enquiries"] as const;

/** The query key for one staff enquiry, so a transition can invalidate its detail. */
export function staffEnquiryQueryKey(enquiryId: string) {
  return [...STAFF_ENQUIRIES_QUERY_KEY, enquiryId] as const;
}

export interface StaffEnquiriesQuery {
  readonly status?: string;
  readonly hotelId?: string;
  readonly cursor?: string;
}

/** The staff hotel-enquiry pipeline (`GET /consultancy-admin/enquiries`); internal (staff) fields. */
export function useStaffEnquiries(query: StaffEnquiriesQuery = {}) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.hotelId) params.set("hotelId", query.hotelId);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return useQuery<HotelEnquiryStaffPage>({
    queryKey: [...STAFF_ENQUIRIES_QUERY_KEY, query],
    queryFn: ({ signal }) =>
      api.get(
        `/consultancy-admin/enquiries${suffix ? `?${suffix}` : ""}`,
        hotelEnquiryStaffPage,
        signal,
      ),
  });
}

/** One staff enquiry with its internal detail — notes, assignee and all events (`GET …/enquiries/:id`). */
export function useStaffEnquiry(enquiryId: string) {
  const api = useApiClient();
  return useQuery<HotelEnquiryStaffDetailView>({
    queryKey: staffEnquiryQueryKey(enquiryId),
    queryFn: ({ signal }) =>
      api.get(`/consultancy-admin/enquiries/${enquiryId}`, hotelEnquiryStaffDetailView, signal),
    enabled: Boolean(enquiryId),
  });
}

/**
 * Advance an enquiry's status (`PATCH /consultancy-admin/enquiries/:id/status`). The body carries the
 * target status plus, on a close, the mandatory outcome and an optional summary. Success refreshes the
 * enquiry list and this enquiry's detail (STAFF_ENQUIRIES_QUERY_KEY is a prefix of both keys).
 */
export function useTransitionEnquiry(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelEnquiryStaffView, Error, HotelEnquiryStatusUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy-admin/enquiries/${enquiryId}/status`, {
        method: "PATCH",
        body,
        schema: hotelEnquiryStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
  });
}
