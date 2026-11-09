import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hotelImportResult, type HotelImportRequest, type HotelImportResult } from "@ampm/core";

import { useApiClient } from "../provider";
import { STAFF_HOTELS_QUERY_KEY } from "./use-staff-hotels";

/**
 * Bulk-import hotels from CSV text (`POST /hotels-admin/imports`,
 * `hotels.hotel_profiles_client_fields.create` — Hotel team and Super Admin). `dryRun` validates and
 * reports only; a real run upserts the valid rows in one transaction (invalid rows are reported, never
 * applied) and, when anything was written, refreshes the staff catalogue so the new hotels appear.
 */
export function useHotelImport() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelImportResult, Error, HotelImportRequest>({
    mutationFn: (body) =>
      api.request("/hotels-admin/imports", { method: "POST", body, schema: hotelImportResult }),
    onSuccess: (result) => {
      if (result.applied) {
        void queryClient.invalidateQueries({ queryKey: STAFF_HOTELS_QUERY_KEY });
      }
    },
  });
}
