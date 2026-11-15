import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hotelEnquiryAssigneeList,
  hotelEnquiryStaffView,
  type HotelEnquiryAssigneeList,
  type HotelEnquiryStaffUpdateRequest,
  type HotelEnquiryStaffView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { STAFF_ENQUIRIES_QUERY_KEY } from "./use-staff-enquiries";

/**
 * Its own key, outside STAFF_ENQUIRIES_QUERY_KEY: the team changes far less often than the queue, so a
 * status move or an owner change does not refetch it.
 */
export const ENQUIRY_ASSIGNEES_QUERY_KEY = ["consultancy-admin", "enquiry-assignees"] as const;

/** How long the team list is trusted before a refetch: someone joining shows up within minutes. */
const ASSIGNEES_STALE_MS = 5 * 60 * 1000;

/**
 * Who an enquiry can be handed to (`GET /consultancy-admin/enquiries/assignees`): the active staff whose
 * roles let them work every enquiry, by name, id and name only. Only a reader who may reassign
 * (`consultancy.enquiries.update`) gets the list; anyone else is refused (403), so pass `enabled: false`
 * where the picker is not shown.
 *
 *   const team = useEnquiryAssignees();
 */
export function useEnquiryAssignees({ enabled = true }: { readonly enabled?: boolean } = {}) {
  const api = useApiClient();
  return useQuery<HotelEnquiryAssigneeList>({
    queryKey: ENQUIRY_ASSIGNEES_QUERY_KEY,
    queryFn: ({ signal }) =>
      api.get("/consultancy-admin/enquiries/assignees", hotelEnquiryAssigneeList, signal),
    staleTime: ASSIGNEES_STALE_MS,
    enabled,
  });
}

/**
 * Edit an enquiry's internal fields (`PATCH /consultancy-admin/enquiries/:id`): hand it to someone on
 * the hotel team, take it back to nobody (`assignedUserId: null`), or change the internal notes. The
 * server refuses an owner who cannot work the enquiry (400 on `assignedUserId`) and audits the change.
 * Success refreshes the queue, the pipeline's counts and this enquiry's detail (all under
 * STAFF_ENQUIRIES_QUERY_KEY), since its holder shows on each.
 *
 *   const update = useUpdateStaffEnquiry(enquiry.id);
 *   update.mutate({ assignedUserId: me });
 */
export function useUpdateStaffEnquiry(enquiryId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelEnquiryStaffView, Error, HotelEnquiryStaffUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/consultancy-admin/enquiries/${enquiryId}`, {
        method: "PATCH",
        body,
        schema: hotelEnquiryStaffView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_ENQUIRIES_QUERY_KEY });
    },
  });
}
