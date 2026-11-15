import { useRouter, type Href } from "expo-router";

import { hotelEnquiryStage, type HotelEnquiryStage } from "@ampm/core";

/**
 * The queue's stage filter lives in the address (`/enquiries?stage=proposal`, kept on
 * `/enquiries/[id]?stage=proposal` beside it), so a refresh, a shared link or Back keeps it. The routes
 * read the param and hand the screens a parsed stage; these helpers parse it, write it and carry it
 * onto the paths the queue opens.
 */

/** The `stage` search param as a stage, or null for none (or one the API would not know). */
export function parseQueueStage(value: string | string[] | undefined): HotelEnquiryStage | null {
  const parsed = hotelEnquiryStage.safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : null;
}

/** The queue's page, with the stage carried along: `/enquiries?stage=proposal`. */
export function queueHref(stage: HotelEnquiryStage | null): Href {
  return stage === null ? "/enquiries" : `/enquiries?stage=${stage}`;
}

/** An enquiry's page, with the queue's stage carried along: `/enquiries/abc?stage=proposal`. */
export function enquiryHref(id: string, stage: HotelEnquiryStage | null): Href {
  return stage === null ? `/enquiries/${id}` : `/enquiries/${id}?stage=${stage}`;
}

/** Writes the chosen stage into the current address (no new history entry); null clears it. */
export function useSetQueueStage(): (stage: HotelEnquiryStage | null) => void {
  const router = useRouter();
  return (stage) => router.setParams({ stage: stage ?? undefined });
}
