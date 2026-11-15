import { useRouter, type Href } from "expo-router";

import {
  hotelEnquiryAssigneeFilter,
  hotelEnquiryStage,
  type HotelEnquiryAssigneeFilter,
  type HotelEnquiryStage,
} from "@ampm/core";

/**
 * The queue's filters live in the address (`/enquiries?stage=proposal&assignee=me`, kept on
 * `/enquiries/[id]?stage=proposal&assignee=me` beside it), so a refresh, a shared link or Back keeps
 * them: the pipeline stage, and who holds the enquiry (the reader's own open ones, or the open ones
 * nobody holds). The routes read the params and hand the screens parsed values; these helpers parse
 * them, write them and carry them onto the paths the queue opens.
 */

type Param = string | string[] | undefined;

const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

/** The `stage` search param as a stage, or null for none (or one the API would not know). */
export function parseQueueStage(value: Param): HotelEnquiryStage | null {
  const parsed = hotelEnquiryStage.safeParse(first(value));
  return parsed.success ? parsed.data : null;
}

/** The `assignee` search param (`me` or `unassigned`), or null for everyone's. */
export function parseQueueAssignee(value: Param): HotelEnquiryAssigneeFilter | null {
  const parsed = hotelEnquiryAssigneeFilter.safeParse(first(value));
  return parsed.success ? parsed.data : null;
}

/** The filters as a query string without its "?", or "" when none is on. */
function query(stage: HotelEnquiryStage | null, assignee: HotelEnquiryAssigneeFilter | null) {
  const params = [stage ? `stage=${stage}` : null, assignee ? `assignee=${assignee}` : null];
  return params.filter(Boolean).join("&");
}

/** The queue's page, with its filters carried along: `/enquiries?stage=proposal&assignee=me`. */
export function queueHref(
  stage: HotelEnquiryStage | null,
  assignee: HotelEnquiryAssigneeFilter | null = null,
): Href {
  const filters = query(stage, assignee);
  return filters ? `/enquiries?${filters}` : "/enquiries";
}

/** An enquiry's page, with the queue's filters carried along: `/enquiries/abc?stage=proposal`. */
export function enquiryHref(
  id: string,
  stage: HotelEnquiryStage | null,
  assignee: HotelEnquiryAssigneeFilter | null = null,
): Href {
  const filters = query(stage, assignee);
  return filters ? `/enquiries/${id}?${filters}` : `/enquiries/${id}`;
}

/** Writes the chosen stage into the current address (no new history entry); null clears it. */
export function useSetQueueStage(): (stage: HotelEnquiryStage | null) => void {
  const router = useRouter();
  return (stage) => router.setParams({ stage: stage ?? undefined });
}

/** Writes the chosen holder filter into the current address; null (everyone's) clears it. */
export function useSetQueueAssignee(): (assignee: HotelEnquiryAssigneeFilter | null) => void {
  const router = useRouter();
  return (assignee) => router.setParams({ assignee: assignee ?? undefined });
}
