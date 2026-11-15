import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hotelEnquiryPipelineView,
  hotelEnquiryStaffDetailView,
  hotelEnquiryStaffPage,
  hotelEnquiryStaffView,
  type HotelEnquiryAssigneeFilter,
  type HotelEnquiryPipelineView,
  type HotelEnquiryStage,
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
  /** One pipeline stage's statuses (the queue's filter). */
  readonly stage?: HotelEnquiryStage | undefined;
  /** Who holds it: the reader's open enquiries, or the open ones nobody holds. */
  readonly assignee?: HotelEnquiryAssigneeFilter | undefined;
  readonly hotelId?: string;
  /** One client's enquiries (the account hub). */
  readonly accountId?: string;
  readonly cursor?: string;
}

/**
 * The staff queue's address for a query: `/consultancy-admin/enquiries?stage=new&assignee=me`, with only
 * the filters given, in a fixed order.
 *
 * @example
 * staffEnquiriesPath({ assignee: "unassigned" }); // "/consultancy-admin/enquiries?assignee=unassigned"
 */
export function staffEnquiriesPath(query: StaffEnquiriesQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.stage) params.set("stage", query.stage);
  if (query.assignee) params.set("assignee", query.assignee);
  if (query.hotelId) params.set("hotelId", query.hotelId);
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return `/consultancy-admin/enquiries${suffix ? `?${suffix}` : ""}`;
}

/**
 * The staff hotel-enquiry pipeline (`GET /consultancy-admin/enquiries`); internal (staff) fields.
 * Pass `enabled: false` when the signed-in role lacks the grant, so no refused request is sent.
 */
export function useStaffEnquiries(
  query: StaffEnquiriesQuery = {},
  options: { readonly enabled?: boolean } = {},
) {
  const api = useApiClient();
  return useQuery<HotelEnquiryStaffPage>({
    queryKey: [...STAFF_ENQUIRIES_QUERY_KEY, query],
    enabled: options.enabled ?? true,
    queryFn: ({ signal }) => api.get(staffEnquiriesPath(query), hotelEnquiryStaffPage, signal),
  });
}

/**
 * The pipeline's stage counts and the open enquiries nobody holds (`GET …/enquiries/pipeline`). Under
 * STAFF_ENQUIRIES_QUERY_KEY, so every transition and proposal change that refreshes the queue refreshes
 * these counts too.
 */
export function useStaffEnquiryPipeline() {
  const api = useApiClient();
  return useQuery<HotelEnquiryPipelineView>({
    queryKey: [...STAFF_ENQUIRIES_QUERY_KEY, "pipeline"],
    queryFn: ({ signal }) =>
      api.get("/consultancy-admin/enquiries/pipeline", hotelEnquiryPipelineView, signal),
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
