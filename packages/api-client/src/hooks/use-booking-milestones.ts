import { useQuery } from "@tanstack/react-query";
import {
  bookingMilestoneClientPage,
  bookingMilestoneClientView,
  type BookingMilestoneClientPage,
  type BookingMilestoneClientView,
} from "@ampm/core";

import { useApiClient } from "../provider";

/** The query key for one enquiry's booking milestones. */
export function bookingMilestonesQueryKey(enquiryId: string) {
  return ["consultancy", "enquiries", enquiryId, "milestones"] as const;
}

/** The query key for one booking milestone. */
export function bookingMilestoneQueryKey(milestoneId: string) {
  return ["consultancy", "milestones", milestoneId] as const;
}

/**
 * The client's own booking milestones for an enquiry (`GET /consultancy/enquiries/:id/milestones`); the
 * amount loads only where AMPM has enabled it (W-14), and never any internal reference.
 */
export function useBookingMilestones(enquiryId: string, query: { status?: string } = {}) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  const suffix = params.toString();
  return useQuery<BookingMilestoneClientPage>({
    queryKey: [...bookingMilestonesQueryKey(enquiryId), query],
    queryFn: ({ signal }) =>
      api.get(
        `/consultancy/enquiries/${enquiryId}/milestones${suffix ? `?${suffix}` : ""}`,
        bookingMilestoneClientPage,
        signal,
      ),
    enabled: Boolean(enquiryId),
  });
}

/** One of the client's own booking milestones (`GET /consultancy/milestones/:id`). */
export function useBookingMilestone(milestoneId: string) {
  const api = useApiClient();
  return useQuery<BookingMilestoneClientView>({
    queryKey: bookingMilestoneQueryKey(milestoneId),
    queryFn: ({ signal }) =>
      api.get(`/consultancy/milestones/${milestoneId}`, bookingMilestoneClientView, signal),
    enabled: Boolean(milestoneId),
  });
}
