import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hotelProposalInternalPage,
  hotelProposalInternalView,
  type HotelProposalInternalPage,
  type HotelProposalInternalView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { STAFF_ENQUIRIES_QUERY_KEY, staffEnquiryQueryKey } from "./use-staff-enquiries";

export const STAFF_PROPOSALS_QUERY_KEY = ["consultancy-admin", "proposals"] as const;

export function staffProposalsQueryKey(enquiryId: string) {
  return [...STAFF_PROPOSALS_QUERY_KEY, { enquiryId }] as const;
}

/**
 * The staff (internal) proposals for an enquiry (`GET /consultancy-admin/proposals?enquiryId=`): the
 * internal total, the derived margin and every line — including the non-client-visible ones.
 */
export function useStaffProposals(enquiryId: string) {
  const api = useApiClient();
  return useQuery<HotelProposalInternalPage>({
    queryKey: staffProposalsQueryKey(enquiryId),
    queryFn: ({ signal }) =>
      api.get(
        `/consultancy-admin/proposals?enquiryId=${enquiryId}`,
        hotelProposalInternalPage,
        signal,
      ),
    enabled: Boolean(enquiryId),
  });
}

/** Share a draft proposal with the client (`POST /consultancy-admin/proposals/:id/share`). */
export function useShareProposal(proposalId: string, enquiryId: string) {
  return useProposalAction(proposalId, enquiryId, "share");
}

/** Supersede a shared proposal with a fresh draft to re-price (`POST /consultancy-admin/…/:id/revise`). */
export function useReviseProposal(proposalId: string, enquiryId: string) {
  return useProposalAction(proposalId, enquiryId, "revise");
}

/** The shared body for the two no-body proposal POST actions; both refresh the proposals and the enquiry
 *  (sharing auto-advances the enquiry to client_decision; revising supersedes the prior version). */
function useProposalAction(proposalId: string, enquiryId: string, action: "share" | "revise") {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelProposalInternalView, Error, void>({
    mutationFn: () =>
      api.request(`/consultancy-admin/proposals/${proposalId}/${action}`, {
        method: "POST",
        schema: hotelProposalInternalView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffProposalsQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
  });
}
