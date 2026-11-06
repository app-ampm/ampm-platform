import type { SiteVisitClientView, SiteVisitStaffView } from "@ampm/core";

import type { SiteVisitRow } from "./site-visits.repository.js";

/**
 * One serialiser per audience (security.md). The client view carries date, status and the client's own
 * feedback (CLIENT); `attendees_text` (INTERNAL) and `outcome_internal` (RESTRICTED-NOTES) are ABSENT,
 * never a hide-flag. The return type is the `@ampm/core` view, so TypeScript rejects any stray field.
 * Any staff reader with `consultancy.site_visits.read` (SA/SM/HT/PM) sees the full staff view; FA has no
 * grant, so no staff reader is ever shown a partial view.
 */

function iso(date: Date): string {
  return date.toISOString();
}

export function toSiteVisitClientView(row: SiteVisitRow): SiteVisitClientView {
  return {
    id: row.id,
    enquiryId: row.enquiryId,
    hotelId: row.hotelId,
    scheduledAt: iso(row.scheduledAt),
    status: row.status,
    clientFeedback: row.clientFeedback,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toSiteVisitStaffView(row: SiteVisitRow): SiteVisitStaffView {
  return {
    ...toSiteVisitClientView(row),
    attendeesText: row.attendeesText,
    outcomeInternal: row.outcomeInternal,
    createdBy: row.createdBy,
  };
}
