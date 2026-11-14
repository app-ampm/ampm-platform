import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hotelEnquiryClientView, type HotelEnquiryClientView } from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTEL_ENQUIRIES_QUERY_KEY, hotelEnquiryQueryKey } from "./use-hotel-enquiries";

/**
 * Withdraw the client's own enquiry (`POST /consultancy/enquiries/:id/withdraw`). No body; the server
 * closes it with outcome `withdrawn` and returns the updated enquiry. Refreshes the detail and the list.
 */
export function useWithdrawEnquiry(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelEnquiryClientView, Error, void>({
    mutationFn: () =>
      api.request(`/consultancy/enquiries/${enquiryId}/withdraw`, {
        method: "POST",
        schema: hotelEnquiryClientView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: HOTEL_ENQUIRIES_QUERY_KEY });
    },
  });
}
