import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  hotelEnquiryClientView,
  type HotelEnquiryClientUpdateRequest,
  type HotelEnquiryClientView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTEL_ENQUIRIES_QUERY_KEY, hotelEnquiryQueryKey } from "./use-hotel-enquiries";

/** Edit the client's own note on an enquiry (`PATCH /consultancy/enquiries/:id`). Refreshes the enquiry. */
export function useUpdateEnquiryNote(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelEnquiryClientView, Error, HotelEnquiryClientUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy/enquiries/${enquiryId}`, {
        method: "PATCH",
        body,
        schema: hotelEnquiryClientView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: HOTEL_ENQUIRIES_QUERY_KEY });
    },
  });
}
