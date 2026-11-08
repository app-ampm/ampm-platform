import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  leadActivityView,
  leadView,
  type LeadActivityCreateRequest,
  type LeadActivityView,
  type LeadAssignRequest,
  type LeadUpdateRequest,
  type LeadView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { LEADS_QUERY_KEY } from "./use-leads";

/*
 * The Sales workspace's working actions on a lead (TW-11/TW-12, all `crm.leads.update`): log an activity,
 * move the lead through its lifecycle or edit it, and assign its owner. Each invalidates the LEADS prefix,
 * which refreshes the list, the lead detail and its activity timeline alike (every lead query sits under it).
 */

/** Log an activity on a lead's timeline (`POST /crm/leads/:id/activities`). */
export function useAddLeadActivity(leadId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<LeadActivityView, Error, LeadActivityCreateRequest>({
    mutationFn: (body) =>
      api.request(`/crm/leads/${leadId}/activities`, {
        method: "POST",
        body,
        schema: leadActivityView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
    },
  });
}

/** Update a lead — a status move or a field edit (`PATCH /crm/leads/:id`); the server validates the
 *  transition, so an invalid move is a `conflict` the caller surfaces as a message. */
export function useUpdateLead(leadId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<LeadView, Error, LeadUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/crm/leads/${leadId}`, { method: "PATCH", body, schema: leadView }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
    },
  });
}

/** Assign or clear a lead's owner (`PATCH /crm/leads/:id/owner`); `ownerUserId: null` unassigns. */
export function useAssignLeadOwner(leadId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<LeadView, Error, LeadAssignRequest>({
    mutationFn: (body) =>
      api.request(`/crm/leads/${leadId}/owner`, { method: "PATCH", body, schema: leadView }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
    },
  });
}
