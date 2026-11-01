import { useMutation, useQueryClient } from "@tanstack/react-query";
import { leadConvertResponse, type LeadConvertRequest, type LeadConvertResponse } from "@ampm/core";

import { useApiClient } from "../provider";
import { LEADS_QUERY_KEY } from "./use-leads";

/**
 * Converts a lead into a client account and queues the portal invite
 * (`POST /crm/leads/:leadId/convert`, `crm.accounts.create`; 201). On success it invalidates the lead
 * queries so the list and detail reflect the now-`converted` lead. A `conflict` error means the lead was
 * already converted or is closed; the caller surfaces that as a message, not a generic failure.
 */
export function useConvertLead(leadId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<LeadConvertResponse, Error, LeadConvertRequest>({
    mutationFn: (body) =>
      api.request(`/crm/leads/${leadId}/convert`, {
        method: "POST",
        body,
        schema: leadConvertResponse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
    },
  });
}
