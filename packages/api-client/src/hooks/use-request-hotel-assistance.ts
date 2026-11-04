import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  hotelAssistanceRequestResponse,
  type HotelAssistanceRequestResponse,
  type HotelEnquiryCreateRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTEL_ENQUIRIES_QUERY_KEY } from "./use-hotel-enquiries";

/**
 * Request hotel assistance for a discovered hotel (`POST /consultancy/enquiries`, 201). A subscriber opens
 * an enquiry (idempotent per hotel); a demo prospect is routed to Sales (P-7) with no enquiry created. On
 * success it refreshes the enquiries list.
 */
export function useRequestHotelAssistance() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelAssistanceRequestResponse, Error, HotelEnquiryCreateRequest>({
    mutationFn: (body) =>
      api.request("/consultancy/enquiries", {
        method: "POST",
        body,
        schema: hotelAssistanceRequestResponse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HOTEL_ENQUIRIES_QUERY_KEY });
    },
  });
}
