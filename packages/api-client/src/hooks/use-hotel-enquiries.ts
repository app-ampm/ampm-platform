import { useQuery } from "@tanstack/react-query";
import {
  hotelEnquiryClientDetailView,
  hotelEnquiryClientPage,
  type HotelEnquiryClientDetailView,
  type HotelEnquiryClientView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList } from "./use-cursor-list";

export const HOTEL_ENQUIRIES_QUERY_KEY = ["consultancy", "enquiries"] as const;

/** The query key for one enquiry, so a mutation can target or invalidate it. */
export function hotelEnquiryQueryKey(enquiryId: string) {
  return [...HOTEL_ENQUIRIES_QUERY_KEY, enquiryId] as const;
}

export interface HotelEnquiriesQuery {
  readonly status?: string;
}

function hotelEnquiriesPath(query: HotelEnquiriesQuery, cursor: string | undefined): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (cursor) params.set("cursor", cursor);
  const suffix = params.toString();
  return `/consultancy/enquiries${suffix ? `?${suffix}` : ""}`;
}

/** The caller's own hotel enquiries (`GET /consultancy/enquiries`), cursor-paginated with a "Load more" footer (B10); CLIENT fields only. */
export function useHotelEnquiries(query: HotelEnquiriesQuery = {}) {
  const api = useApiClient();
  return useCursorList<HotelEnquiryClientView>(
    [...HOTEL_ENQUIRIES_QUERY_KEY, query],
    (cursor, signal) => api.get(hotelEnquiriesPath(query, cursor), hotelEnquiryClientPage, signal),
  );
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
