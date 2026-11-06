import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";

/**
 * Module D — Hotel consultancy contracts (docs/data-model.md §6, permission-matrix §5.4/§7).
 *
 * One response model per audience (security.md): the client views carry CLIENT fields only, so
 * `notes_internal` (RESTRICTED-NOTES), the assignee, the service agreement and internal-only events are
 * ABSENT from them — never a hide-flag. The ten-status machine + its transitions live in `@ampm/policy`
 * (statuses.ts, generated matrix.json §7); these enums only name the states.
 */

/** A calendar date on the wire (no time); the DB column is `date`. */
const isoDate = z.iso.date();

export const hotelEnquiryStatus = z.enum([
  "draft",
  "submitted",
  "awaiting_hotel",
  "response_received",
  "negotiating",
  "visit_scheduled",
  "proposal_received",
  "client_decision",
  "confirmed",
  "closed",
]);
export type HotelEnquiryStatus = z.infer<typeof hotelEnquiryStatus>;

export const hotelEnquiryOutcome = z.enum(["booked", "declined", "no_availability", "withdrawn"]);
export type HotelEnquiryOutcome = z.infer<typeof hotelEnquiryOutcome>;

export const hotelEnquiryEventType = z.enum([
  "submitted",
  "sent_to_hotel",
  "hotel_response",
  "negotiation_note",
  "client_update",
  "status_change",
  "visit",
  "proposal",
]);
export type HotelEnquiryEventType = z.infer<typeof hotelEnquiryEventType>;

// --- Requests ---------------------------------------------------------------------------------------

/** CP-07 "request hotel assistance": a subscriber (or agreement/project client) opens an enquiry. */
export const hotelEnquiryCreateRequest = z
  .object({
    hotelId: uuid,
    dateFrom: isoDate,
    dateTo: isoDate,
    datesFlexible: z.boolean().default(false),
    guestEstimate: z.number().int().min(1),
    roomsRequired: z.number().int().min(0).nullable().default(null),
    functionsSummary: z.string().max(2000).nullable().default(null),
    contactPreference: z.string().max(255).nullable().default(null),
    notesClient: z.string().max(4000).nullable().default(null),
  })
  .strict()
  .refine((v) => v.dateTo >= v.dateFrom, {
    message: "dateTo must be on or after dateFrom",
    path: ["dateTo"],
  });
export type HotelEnquiryCreateRequest = z.infer<typeof hotelEnquiryCreateRequest>;

/** A client edits their own free-text note on an enquiry (§5.4: CR update own `notes_client`). */
export const hotelEnquiryClientUpdateRequest = z
  .object({ notesClient: z.string().max(4000).nullable() })
  .strict();
export type HotelEnquiryClientUpdateRequest = z.infer<typeof hotelEnquiryClientUpdateRequest>;

/** A staff status transition (HT drives the pipeline); `outcome` is required when moving to `closed`. */
export const hotelEnquiryStatusUpdateRequest = z
  .object({
    status: hotelEnquiryStatus,
    outcome: hotelEnquiryOutcome.nullable().default(null),
    summary: z.string().max(2000).nullable().default(null),
  })
  .strict();
export type HotelEnquiryStatusUpdateRequest = z.infer<typeof hotelEnquiryStatusUpdateRequest>;

/** Staff edits internal fields (assignee, internal notes) — never client-visible. */
export const hotelEnquiryStaffUpdateRequest = z
  .object({
    assignedUserId: uuid.nullable().optional(),
    notesInternal: z.string().max(4000).nullable().optional(),
  })
  .strict();
export type HotelEnquiryStaffUpdateRequest = z.infer<typeof hotelEnquiryStaffUpdateRequest>;

/** Staff appends a timeline event (hotel response, negotiation note, …). */
export const hotelEnquiryEventCreateRequest = z
  .object({
    eventType: hotelEnquiryEventType,
    summary: z.string().max(2000).nullable().default(null),
    internalOnly: z.boolean().default(false),
    documentId: uuid.nullable().default(null),
  })
  .strict();
export type HotelEnquiryEventCreateRequest = z.infer<typeof hotelEnquiryEventCreateRequest>;

export const hotelEnquiryListQuery = cursorQuery.extend({
  status: hotelEnquiryStatus.optional(),
  hotelId: uuid.optional(),
});
export type HotelEnquiryListQuery = z.infer<typeof hotelEnquiryListQuery>;

// --- Views ------------------------------------------------------------------------------------------

/** A client-visible timeline event: the actor, the internal-only flag and internal docs are absent. */
export const hotelEnquiryEventClientView = z
  .object({
    id: uuid,
    eventType: hotelEnquiryEventType,
    occurredAt: isoDateTime,
    summary: z.string().nullable(),
  })
  .strict();
export type HotelEnquiryEventClientView = z.infer<typeof hotelEnquiryEventClientView>;

/** The full internal timeline event (staff audience). */
export const hotelEnquiryEventView = z
  .object({
    id: uuid,
    enquiryId: uuid,
    eventType: hotelEnquiryEventType,
    occurredAt: isoDateTime,
    userId: uuid,
    summary: z.string().nullable(),
    internalOnly: z.boolean(),
    documentId: uuid.nullable(),
    createdAt: isoDateTime,
  })
  .strict();
export type HotelEnquiryEventView = z.infer<typeof hotelEnquiryEventView>;

const enquiryClientFields = {
  id: uuid,
  hotelId: uuid,
  projectId: uuid.nullable(),
  status: hotelEnquiryStatus,
  dateFrom: isoDate,
  dateTo: isoDate,
  datesFlexible: z.boolean(),
  guestEstimate: z.number().int(),
  roomsRequired: z.number().int().nullable(),
  functionsSummary: z.string().nullable(),
  contactPreference: z.string().nullable(),
  notesClient: z.string().nullable(),
  outcome: hotelEnquiryOutcome.nullable(),
  submittedAt: isoDateTime.nullable(),
  closedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
} as const;

export const hotelEnquiryClientView = z.object(enquiryClientFields).strict();
export type HotelEnquiryClientView = z.infer<typeof hotelEnquiryClientView>;

export const hotelEnquiryClientDetailView = z
  .object({ ...enquiryClientFields, events: z.array(hotelEnquiryEventClientView) })
  .strict();
export type HotelEnquiryClientDetailView = z.infer<typeof hotelEnquiryClientDetailView>;

const enquiryStaffFields = {
  ...enquiryClientFields,
  accountId: uuid,
  requestedByUserId: uuid,
  assignedUserId: uuid.nullable(),
  serviceAgreementId: uuid.nullable(),
  // RESTRICTED-NOTES: present only for a staff audience that holds `consultancy.enquiry_notes.read`
  // (SA/SM/HT/PM). It is ABSENT — not null — for a staff reader without it (FA), per security.md.
  notesInternal: z.string().nullable().optional(),
} as const;

export const hotelEnquiryStaffView = z.object(enquiryStaffFields).strict();
export type HotelEnquiryStaffView = z.infer<typeof hotelEnquiryStaffView>;

export const hotelEnquiryStaffDetailView = z
  .object({ ...enquiryStaffFields, events: z.array(hotelEnquiryEventView) })
  .strict();
export type HotelEnquiryStaffDetailView = z.infer<typeof hotelEnquiryStaffDetailView>;

export const hotelEnquiryClientPage = page(hotelEnquiryClientView);
export type HotelEnquiryClientPage = z.infer<typeof hotelEnquiryClientPage>;

export const hotelEnquiryStaffPage = page(hotelEnquiryStaffView);
export type HotelEnquiryStaffPage = z.infer<typeof hotelEnquiryStaffPage>;

/**
 * The response to CP-07: a subscriber opens an enquiry; a demo prospect is routed to Sales (P-7) and
 * no enquiry exists. A discriminated union keeps the client typed for both branches.
 */
export const hotelAssistanceRequestResponse = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enquiry"), enquiry: hotelEnquiryClientView }).strict(),
  z.object({ kind: z.literal("routed_to_sales") }).strict(),
]);
export type HotelAssistanceRequestResponse = z.infer<typeof hotelAssistanceRequestResponse>;
