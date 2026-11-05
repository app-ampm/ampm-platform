import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";

/**
 * Module D — hotel site visits (docs/data-model.md §6, permission-matrix §5.4, feature 10.3, AC-05.5).
 *
 * A visit to the enquiry's hotel. One response model per audience (security.md): the client view carries
 * date, status and the client's own `client_feedback` (CLIENT) — `attendees_text` (INTERNAL) and
 * `outcome_internal` (RESTRICTED-NOTES) are ABSENT from it, never a hide-flag, and never reach a
 * client/guest/demo principal. The status machine (proposed → confirmed → completed, cancel from any
 * non-terminal) is hand-rolled in the consultancy module; these enums only name the states.
 */

export const siteVisitStatus = z.enum(["proposed", "confirmed", "completed", "cancelled"]);
export type SiteVisitStatus = z.infer<typeof siteVisitStatus>;

// --- Requests ---------------------------------------------------------------------------------------

/** Staff schedules a visit for an enquiry (§5.4: SA/HT create, PM(a)). The hotel is the enquiry's own,
 * resolved server-side — never taken from the request. Status starts `proposed`. */
export const siteVisitCreateRequest = z
  .object({
    enquiryId: uuid,
    scheduledAt: isoDateTime,
    attendeesText: z.string().max(2000).nullable().default(null),
  })
  .strict();
export type SiteVisitCreateRequest = z.infer<typeof siteVisitCreateRequest>;

/** Staff edits a visit's scheduling, attendees or the internal outcome (never client-visible). */
export const siteVisitUpdateRequest = z
  .object({
    scheduledAt: isoDateTime.optional(),
    attendeesText: z.string().max(2000).nullable().optional(),
    outcomeInternal: z.string().max(4000).nullable().optional(),
  })
  .strict();
export type SiteVisitUpdateRequest = z.infer<typeof siteVisitUpdateRequest>;

/** A staff status move (confirm, complete, cancel). */
export const siteVisitTransitionRequest = z.object({ status: siteVisitStatus }).strict();
export type SiteVisitTransitionRequest = z.infer<typeof siteVisitTransitionRequest>;

/** The client submits or updates their own feedback on a visit (CP, their own enquiry's visit only). */
export const siteVisitFeedbackRequest = z
  .object({ clientFeedback: z.string().max(4000).nullable() })
  .strict();
export type SiteVisitFeedbackRequest = z.infer<typeof siteVisitFeedbackRequest>;

export const siteVisitListQuery = cursorQuery.extend({
  enquiryId: uuid.optional(),
  status: siteVisitStatus.optional(),
});
export type SiteVisitListQuery = z.infer<typeof siteVisitListQuery>;

// --- Views ------------------------------------------------------------------------------------------

const visitClientFields = {
  id: uuid,
  enquiryId: uuid,
  hotelId: uuid,
  scheduledAt: isoDateTime,
  status: siteVisitStatus,
  clientFeedback: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
} as const;

export const siteVisitClientView = z.object(visitClientFields).strict();
export type SiteVisitClientView = z.infer<typeof siteVisitClientView>;

const visitStaffFields = {
  ...visitClientFields,
  // INTERNAL + RESTRICTED-NOTES: present for any staff reader with `consultancy.site_visits.read`
  // (SA/SM/HT/PM); FA has no grant, so FA never reaches a site-visit route. Never sent to a client.
  attendeesText: z.string().nullable(),
  outcomeInternal: z.string().nullable(),
  createdBy: uuid.nullable(),
} as const;

export const siteVisitStaffView = z.object(visitStaffFields).strict();
export type SiteVisitStaffView = z.infer<typeof siteVisitStaffView>;

export const siteVisitClientPage = page(siteVisitClientView);
export type SiteVisitClientPage = z.infer<typeof siteVisitClientPage>;

export const siteVisitStaffPage = page(siteVisitStaffView);
export type SiteVisitStaffPage = z.infer<typeof siteVisitStaffPage>;
