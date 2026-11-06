import { z } from "zod";

import { cursorQuery, isoDateTime, money, page, uuid } from "./common.js";

/**
 * Module D — hotel booking milestones (docs/data-model.md §6, permission-matrix §5.4, feature 10.5,
 * AC-05.6). The milestones that close the pipeline: an enquiry reaches `confirmed` only once a
 * `confirmed` milestone is `done` and a signed contract exists (the guard lives in the enquiry service,
 * never here). Payments are recorded, not collected (offline bank transfer in v1).
 *
 * One `amount` column — no client/internal split (A-4): the client MAY see it, but it is HIDDEN BY
 * DEFAULT behind the W-14 config flag `consultancy.milestone_amounts_visible`. The client view OMITS the
 * amount entirely unless the flag is on (security.md: absent, never a hide-flag), so the amount reaches a
 * client only where AMPM has confirmed the client pays the hotel directly. The status machine
 * (pending → done | overdue | cancelled) is hand-rolled in the consultancy module; these enums only name
 * the states.
 */

export const bookingMilestoneType = z.enum([
  "hold_placed",
  "contract_sent",
  "contract_signed",
  "advance_paid",
  "rooming_list_due",
  "balance_due",
  "confirmed",
]);
export type BookingMilestoneType = z.infer<typeof bookingMilestoneType>;

export const bookingMilestoneStatus = z.enum(["pending", "done", "overdue", "cancelled"]);
export type BookingMilestoneStatus = z.infer<typeof bookingMilestoneStatus>;

// numeric(14,2): the largest storable amount is 999,999,999,999.99 — 99,999,999,999,999 paise.
const MAX_MINOR = 99_999_999_999_999;

/** A milestone amount: non-negative and within the numeric(14,2) column (field-matrix: "0 or more"). */
const milestoneAmount = money.refine(
  (value) => value.minor >= 0 && value.minor <= MAX_MINOR,
  "The amount is out of range",
);

// --- Requests ---------------------------------------------------------------------------------------

/** Staff creates a milestone on an enquiry (§5.4: SA/HT create, PM(a)). Starts `pending`; the enquiry's
 * project is inherited server-side. The amount is entered, never defaulted (data.md). `documentId` is the
 * uploaded signed-contract document for a `contract_signed` milestone — the interim contract signal the
 * confirmed-guard reads (AC-05.6), a plain reference until the Module N documents service lands. */
export const bookingMilestoneCreateRequest = z
  .object({
    enquiryId: uuid,
    milestoneType: bookingMilestoneType,
    dueAt: isoDateTime.nullable().default(null),
    amount: milestoneAmount.nullable().default(null),
    contractId: uuid.nullable().default(null),
    documentId: uuid.nullable().default(null),
  })
  .strict();
export type BookingMilestoneCreateRequest = z.infer<typeof bookingMilestoneCreateRequest>;

/** Staff edits a milestone's due date, amount (FA manages amounts) or its contract/document references.
 * The milestone type is fixed at creation; the status moves through the transition route. */
export const bookingMilestoneUpdateRequest = z
  .object({
    dueAt: isoDateTime.nullable().optional(),
    amount: milestoneAmount.nullable().optional(),
    contractId: uuid.nullable().optional(),
    documentId: uuid.nullable().optional(),
  })
  .strict();
export type BookingMilestoneUpdateRequest = z.infer<typeof bookingMilestoneUpdateRequest>;

/** A staff status move (mark done — recording a payment on a payment milestone — or cancel). `overdue`
 * is reached by the worker sweep, not a manual move. */
export const bookingMilestoneTransitionRequest = z
  .object({ status: bookingMilestoneStatus })
  .strict();
export type BookingMilestoneTransitionRequest = z.infer<typeof bookingMilestoneTransitionRequest>;

export const bookingMilestoneListQuery = cursorQuery.extend({
  enquiryId: uuid.optional(),
  status: bookingMilestoneStatus.optional(),
  milestoneType: bookingMilestoneType.optional(),
});
export type BookingMilestoneListQuery = z.infer<typeof bookingMilestoneListQuery>;

// --- Views ------------------------------------------------------------------------------------------

const milestoneScalars = {
  id: uuid,
  enquiryId: uuid,
  milestoneType: bookingMilestoneType,
  status: bookingMilestoneStatus,
  dueAt: isoDateTime.nullable(),
  completedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
} as const;

/** The client view (CP Booking tab): type, status and dates for their own enquiry's milestones. `amount`
 * is ABSENT unless the W-14 flag is on and the milestone carries one; the contract/document/project
 * references and the audit fields never reach a client. */
export const bookingMilestoneClientView = z
  .object({
    ...milestoneScalars,
    amount: money.optional(),
  })
  .strict();
export type BookingMilestoneClientView = z.infer<typeof bookingMilestoneClientView>;

/** The staff view (§5.4 read: SA/SM/HT/PM/FA): always carries the amount (nullable) plus the internal
 * references and the creator. */
export const bookingMilestoneStaffView = z
  .object({
    ...milestoneScalars,
    amount: money.nullable(),
    projectId: uuid.nullable(),
    contractId: uuid.nullable(),
    documentId: uuid.nullable(),
    createdBy: uuid.nullable(),
  })
  .strict();
export type BookingMilestoneStaffView = z.infer<typeof bookingMilestoneStaffView>;

export const bookingMilestoneClientPage = page(bookingMilestoneClientView);
export type BookingMilestoneClientPage = z.infer<typeof bookingMilestoneClientPage>;

export const bookingMilestoneStaffPage = page(bookingMilestoneStaffView);
export type BookingMilestoneStaffPage = z.infer<typeof bookingMilestoneStaffPage>;
