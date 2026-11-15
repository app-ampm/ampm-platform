import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";
import { hotelProposalStatus } from "./hotel-proposals.js";

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

/**
 * The staff pipeline's stages: the ten statuses folded into the six steps the hotel team works through
 * (the queue's filter and the enquiry's stepper). `new` is the team's to pick up; `with_hotel` covers
 * contacting, hearing back, negotiating and visiting; `proposal` is the client proposal being prepared;
 * `client_decision` waits on the client. A grouping for reading the pipeline, never a status of its own.
 */
export const hotelEnquiryStage = z.enum([
  "new",
  "with_hotel",
  "proposal",
  "client_decision",
  "confirmed",
  "closed",
]);
export type HotelEnquiryStage = z.infer<typeof hotelEnquiryStage>;

export const HOTEL_ENQUIRY_STAGE_STATUSES: Readonly<
  Record<HotelEnquiryStage, readonly HotelEnquiryStatus[]>
> = {
  new: ["draft", "submitted"],
  with_hotel: ["awaiting_hotel", "response_received", "negotiating", "visit_scheduled"],
  proposal: ["proposal_received"],
  client_decision: ["client_decision"],
  confirmed: ["confirmed"],
  closed: ["closed"],
};

/**
 * The stages the team still works on: an outcome (confirmed or closed) is no longer open. The pipeline's
 * "nobody holds it" count and the queue's Mine / Unassigned filters read only these.
 */
export const HOTEL_ENQUIRY_OPEN_STAGES: readonly HotelEnquiryStage[] = [
  "new",
  "with_hotel",
  "proposal",
  "client_decision",
];

/** Every status of an open stage (HOTEL_ENQUIRY_OPEN_STAGES), flattened. */
export const HOTEL_ENQUIRY_OPEN_STATUSES: readonly HotelEnquiryStatus[] =
  HOTEL_ENQUIRY_OPEN_STAGES.flatMap((stage) => HOTEL_ENQUIRY_STAGE_STATUSES[stage]);

/** The stage a status belongs to. */
export function hotelEnquiryStageOf(status: HotelEnquiryStatus): HotelEnquiryStage {
  const found = hotelEnquiryStage.options.find((stage) =>
    HOTEL_ENQUIRY_STAGE_STATUSES[stage].includes(status),
  );
  return found ?? "new";
}

export const hotelEnquiryOutcome = z.enum(["booked", "declined", "no_availability", "withdrawn"]);
export type HotelEnquiryOutcome = z.infer<typeof hotelEnquiryOutcome>;

/**
 * The statuses a client may withdraw their own enquiry from (CP-09): the active pipeline, before it is
 * `confirmed` (a booking) or `closed` (terminal); a `draft` is never a client's. Withdrawing closes the
 * enquiry with outcome `withdrawn`. The server enforces this (EnquiriesClientService) and the client app
 * hides the action outside it; the two must agree, so both read this one list.
 */
export const hotelEnquiryWithdrawableStatuses = [
  "submitted",
  "awaiting_hotel",
  "response_received",
  "negotiating",
  "visit_scheduled",
  "proposal_received",
  "client_decision",
] as const satisfies readonly HotelEnquiryStatus[];

export function isHotelEnquiryWithdrawable(status: HotelEnquiryStatus): boolean {
  return (hotelEnquiryWithdrawableStatuses as readonly HotelEnquiryStatus[]).includes(status);
}

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

/**
 * The staff queue's holder filter: `me` is the open enquiries the reader holds, `unassigned` the open ones
 * nobody holds (the pipeline's `unassignedOpen`). Both are open work only, so each list matches its count.
 */
export const hotelEnquiryAssigneeFilter = z.enum(["me", "unassigned"]);
export type HotelEnquiryAssigneeFilter = z.infer<typeof hotelEnquiryAssigneeFilter>;

export const hotelEnquiryListQuery = cursorQuery.extend({
  status: hotelEnquiryStatus.optional(),
  /** Every status of one pipeline stage (the staff queue's filter); ignored when `status` is given. */
  stage: hotelEnquiryStage.optional(),
  hotelId: uuid.optional(),
  /** One client's enquiries (the account hub, TW-13 Hotels). Staff only: the client list is always
   *  scoped to the caller's own account, so this is ignored there. */
  accountId: uuid.optional(),
  /** Staff only: who holds it (the client's own list ignores it). */
  assignee: hotelEnquiryAssigneeFilter.optional(),
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

/**
 * The newest proposal version on an enquiry, as the staff queue tracks it: which version and where it
 * stands. CLIENT-class fields only (the version chain is client-visible, AC-09); no amount.
 */
export const hotelEnquiryProposalSummary = z
  .object({ id: uuid, versionNumber: z.number().int(), status: hotelProposalStatus })
  .strict();
export type HotelEnquiryProposalSummary = z.infer<typeof hotelEnquiryProposalSummary>;

const enquiryStaffFields = {
  ...enquiryClientFields,
  accountId: uuid,
  // Who sent it and for which hotel, so the queue names them without a request per row. CLIENT-class
  // (the account's name) and PUBLIC (the hotel's); null only if the record is gone.
  accountName: z.string().nullable(),
  hotelName: z.string().nullable(),
  requestedByUserId: uuid,
  assignedUserId: uuid.nullable(),
  // The holder's name, so the queue says who has it without a directory read per row. INTERNAL (a staff
  // member's name, staff audience only); null while nobody holds it or the user record is gone.
  assignedUserName: z.string().nullable(),
  serviceAgreementId: uuid.nullable(),
  latestProposal: hotelEnquiryProposalSummary.nullable(),
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
 * The staff pipeline at a glance (`GET /consultancy-admin/enquiries/pipeline`): how many enquiries in the
 * reader's scope sit at each stage, and how many open ones nobody holds yet. Counts only, no records.
 */
export const hotelEnquiryPipelineView = z
  .object({
    stages: z.record(hotelEnquiryStage, z.number().int().min(0)),
    unassignedOpen: z.number().int().min(0),
    /** The open enquiries the reader holds (the queue's "Mine" filter). */
    mineOpen: z.number().int().min(0),
  })
  .strict();
export type HotelEnquiryPipelineView = z.infer<typeof hotelEnquiryPipelineView>;

/**
 * Someone an enquiry can be handed to (`GET /consultancy-admin/enquiries/assignees`): an active staff
 * member whose roles let them work every enquiry. The id and the name only — the picker needs no more of
 * the staff directory.
 */
export const hotelEnquiryAssignee = z.object({ id: uuid, name: z.string() }).strict();
export type HotelEnquiryAssignee = z.infer<typeof hotelEnquiryAssignee>;

export const hotelEnquiryAssigneeList = z.array(hotelEnquiryAssignee);
export type HotelEnquiryAssigneeList = z.infer<typeof hotelEnquiryAssigneeList>;

/**
 * The response to CP-07: a subscriber opens an enquiry; a demo prospect is routed to Sales (P-7) and
 * no enquiry exists. A discriminated union keeps the client typed for both branches.
 */
export const hotelAssistanceRequestResponse = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enquiry"), enquiry: hotelEnquiryClientView }).strict(),
  z.object({ kind: z.literal("routed_to_sales") }).strict(),
]);
export type HotelAssistanceRequestResponse = z.infer<typeof hotelAssistanceRequestResponse>;
