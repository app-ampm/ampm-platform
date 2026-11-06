import { useQuery } from "@tanstack/react-query";
import {
  hotelEnquiryClientDetailView,
  hotelEnquiryClientPage,
  type HotelEnquiryClientDetailView,
  type HotelEnquiryClientPage,
} from "@ampm/core";

import { useApiClient } from "../provider";

export const HOTEL_ENQUIRIES_QUERY_KEY = ["consultancy", "enquiries"] as const;

/** The query key for one enquiry, so a mutation can target or invalidate it. */
export function hotelEnquiryQueryKey(enquiryId: string) {
  return [...HOTEL_ENQUIRIES_QUERY_KEY, enquiryId] as const;
}

export interface HotelEnquiriesQuery {
  readonly status?: string;
  readonly cursor?: string;
}

/** The caller's own hotel enquiries (`GET /consultancy/enquiries`); CLIENT fields only. */
export function useHotelEnquiries(query: HotelEnquiriesQuery = {}) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return useQuery<HotelEnquiryClientPage>({
    queryKey: [...HOTEL_ENQUIRIES_QUERY_KEY, query],
    queryFn: ({ signal }) =>
      api.get(
        `/consultancy/enquiries${suffix ? `?${suffix}` : ""}`,
        hotelEnquiryClientPage,
        signal,
      ),
  });
}

/** One of the caller's enquiries with its non-internal timeline (`GET /consultancy/enquiries/:id`). */
export function useHotelEnquiry(enquiryId: string) {
  const api = useApiClient();
  return useQuery<HotelEnquiryClientDetailView>({
    queryKey: hotelEnquiryQueryKey(enquiryId),
    queryFn: ({ signal }) =>
      api.get(`/consultancy/enquiries/${enquiryId}`, hotelEnquiryClientDetailView, signal),
    enabled: Boolean(enquiryId),
  });
}
