import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hotelProposalInternalPage,
  hotelProposalInternalView,
  type HotelProposalCreateRequest,
  type HotelProposalInternalPage,
  type HotelProposalInternalView,
  type HotelProposalUpdateRequest,
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

/** Draft a new proposal for an enquiry (`POST /consultancy-admin/proposals`); starts at version 1,
 *  `draft`. Both totals are entered (A-4); the margin is derived server-side and is never sent. */
export function useCreateProposal(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelProposalInternalView, Error, HotelProposalCreateRequest>({
    mutationFn: (body) =>
      api.request("/consultancy-admin/proposals", {
        method: "POST",
        body,
        schema: hotelProposalInternalView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffProposalsQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: staffEnquiryQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
  });
}

/**
 * Edit a DRAFT proposal's terms (`PATCH /consultancy-admin/proposals/:id`): the totals, the valid-until
 * date and, when `lines` is sent, the whole line set. A shared version is immutable (the API 409s); a
 * change to it is a revision. Refreshes the enquiry's proposals and the queue's proposal tag.
 */
export function useUpdateProposal(proposalId: string, enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelProposalInternalView, Error, HotelProposalUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy-admin/proposals/${proposalId}`, {
        method: "PATCH",
        body,
        schema: hotelProposalInternalView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffProposalsQueryKey(enquiryId) });
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
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
