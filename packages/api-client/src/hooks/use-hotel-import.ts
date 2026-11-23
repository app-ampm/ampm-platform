import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hotelImportResult, type HotelImportResult } from "@ampm/core";

import { useApiClient } from "../provider";
import { HOTEL_MEDIA_QUERY_KEY } from "./use-hotel-media";
import { STAFF_DESTINATIONS_QUERY_KEY, STAFF_HOTELS_QUERY_KEY } from "./use-staff-hotels";

/** One run of the hotels import: the CSV text as the file holds it, and whether it only checks. */
export interface HotelImportInput {
  readonly csv: string;
  /** True reports what each row would do and writes nothing; false applies the valid rows. */
  readonly dryRun: boolean;
}

/**
 * The hotels template's import address, its dry run in the query.
 *
 * @example
 * hotelImportPath(true); // "/hotels-admin/imports/hotels?dryRun=true"
 */
export function hotelImportPath(dryRun: boolean): string {
  return `/hotels-admin/imports/hotels?dryRun=${dryRun ? "true" : "false"}`;
}

/**
 * Import hotels from the filled CSV template (`POST /hotels-admin/imports/hotels?dryRun=…`,
 * `hotels.hotel_profiles_client_fields.create`; TW-25, D-181). The file goes up as raw bytes
 * (`application/octet-stream`), never as JSON, so it is read only after the server's guards and may
 * reach the 5 MB cap. A dry run reports each row (create, update with the fields it changes, unchanged
 * or error) and writes nothing; a real run applies the valid rows, where a blank cell leaves a value
 * unchanged. When anything was written (`applied`, false for a run whose rows were all unchanged or
 * rejected) the staff catalogue and the destinations (an import may add one, and each counts its
 * hotels) refresh, and so do the hotels' media lists when it registered images.
 *
 *   const importHotels = useHotelImport();
 *   importHotels.mutate({ csv, dryRun: true });
 */
export function useHotelImport() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<HotelImportResult, Error, HotelImportInput>({
    mutationFn: ({ csv, dryRun }) =>
      api.upload(hotelImportPath(dryRun), {
        body: csv,
        contentType: "application/octet-stream",
        schema: hotelImportResult,
      }),
    onSuccess: (result) => {
      if (result.applied) {
        void queryClient.invalidateQueries({ queryKey: STAFF_HOTELS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: STAFF_DESTINATIONS_QUERY_KEY });
      }
      if (result.mediaRegistered > 0) {
        void queryClient.invalidateQueries({ queryKey: HOTEL_MEDIA_QUERY_KEY });
      }
    },
  });
}
