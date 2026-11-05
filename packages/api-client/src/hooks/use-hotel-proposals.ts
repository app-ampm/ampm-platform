import { useQuery } from "@tanstack/react-query";
import {
  hotelProposalClientPage,
  hotelProposalClientView,
  type HotelProposalClientPage,
  type HotelProposalClientView,
} from "@ampm/core";

import { useApiClient } from "../provider";

/** The query key for one enquiry's proposals, so a decision can invalidate it. */
export function hotelProposalsQueryKey(enquiryId: string) {
  return ["consultancy", "enquiries", enquiryId, "proposals"] as const;
}

/** The query key for one proposal, so a decision can target it. */
export function hotelProposalQueryKey(proposalId: string) {
  return ["consultancy", "proposals", proposalId] as const;
}

/** The client's own proposals for an enquiry (`GET /consultancy/enquiries/:id/proposals`); CLIENT amounts only. */
export function useHotelProposals(enquiryId: string, query: { status?: string } = {}) {
  const api = useApiClient();
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  const suffix = params.toString();
  return useQuery<HotelProposalClientPage>({
    queryKey: [...hotelProposalsQueryKey(enquiryId), query],
    queryFn: ({ signal }) =>
      api.get(
        `/consultancy/enquiries/${enquiryId}/proposals${suffix ? `?${suffix}` : ""}`,
        hotelProposalClientPage,
        signal,
      ),
    enabled: Boolean(enquiryId),
  });
}

/** One of the client's own proposals (`GET /consultancy/proposals/:id`); the internal total never loads. */
export function useHotelProposal(proposalId: string) {
  const api = useApiClient();
  return useQuery<HotelProposalClientView>({
    queryKey: hotelProposalQueryKey(proposalId),
    queryFn: ({ signal }) =>
      api.get(`/consultancy/proposals/${proposalId}`, hotelProposalClientView, signal),
    enabled: Boolean(proposalId),
  });
}
