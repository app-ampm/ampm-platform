import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  hotelProposalClientView,
  type HotelProposalClientView,
  type HotelProposalDecisionRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { hotelProposalQueryKey, hotelProposalsQueryKey } from "./use-hotel-proposals";

/**
 * Record the client's decision on a shared proposal (`POST /consultancy/proposals/:id/decision`, CP-10):
 * accept, decline, or request a revision. `enquiryId` is the proposal's enquiry, so success refreshes
 * both that proposal and the enquiry's proposal list.
 */
export function useDecideHotelProposal(proposalId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelProposalClientView, Error, HotelProposalDecisionRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy/proposals/${proposalId}/decision`, {
        method: "POST",
        body,
        schema: hotelProposalClientView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelProposalQueryKey(proposalId) });
      void queryClient.invalidateQueries({ queryKey: hotelProposalsQueryKey(enquiryId) });
    },
  });
}
