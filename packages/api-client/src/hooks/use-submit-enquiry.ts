import { useMutation } from "@tanstack/react-query";
import { leadEnquiryResponse, type LeadEnquiryRequest, type LeadEnquiryResponse } from "@ampm/core";

import { useApiClient } from "../provider";

/**
 * Submits the public enquiry form (PUB-06). No authentication — the API captures consent, flags a
 * duplicate contact for Sales and notifies them; the response carries only the first name (AC-01.1).
 */
export function useSubmitEnquiry() {
  const api = useApiClient();
  return useMutation<LeadEnquiryResponse, Error, LeadEnquiryRequest>({
    mutationFn: (body) =>
      api.request("/crm/enquiries", { method: "POST", body, schema: leadEnquiryResponse }),
  });
}
