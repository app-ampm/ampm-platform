import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bookingMilestoneStaffPage,
  bookingMilestoneStaffView,
  type BookingMilestoneCreateRequest,
  type BookingMilestoneStaffPage,
  type BookingMilestoneStaffView,
  type BookingMilestoneTransitionRequest,
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
