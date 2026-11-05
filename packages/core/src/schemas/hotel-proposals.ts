import { z } from "zod";

import { cursorQuery, isoDateTime, money, page, uuid } from "./common.js";
import { hotelRateItemType } from "./hotel-rates.js";

/**
 * Module D — hotel proposals (docs/data-model.md §6, permission-matrix §5.4, feature 10.4, AC-05.2/AC-09).
 *
 * The negotiated offer, where client and internal money meet and MUST stay in separate columns (A-4):
 * `client_total_amount` is CLIENT (what the account pays), `internal_total_amount` is RESTRICTED-FINANCE
 * (hotel net / commission basis), and the margin is DERIVED (client − internal), never stored. One
 * response model per audience (security.md): the client view carries the client total + `client_visible`
 * lines only — the internal total, the margin and the non-visible lines are ABSENT, never a hide-flag.
 * The internal total + margin are present in the internal view ONLY for a reader holding
 * `consultancy.proposals.read_internal_amount`. Immutable once shared; a change is a new version that
 * supersedes the old. The status machine is hand-rolled in the module; these enums only name the states.
 */

/** The fee a numeric(14,2) column can hold, in minor units (paise): a value outside [0, this] is a 422,
 * not a column overflow (a 500). Shared by every money field a proposal writes. */
const MAX_MINOR = 99_999_999_999_999;
const amountOk = (m: { minor: number } | undefined): boolean =>
  m === undefined || (m.minor >= 0 && m.minor <= MAX_MINOR);

export const hotelProposalStatus = z.enum([
  "draft",
  "shared",
  "revision_requested",
  "accepted",
  "declined",
  "superseded",
]);
export type HotelProposalStatus = z.infer<typeof hotelProposalStatus>;

/** The client's decision on a shared proposal (CP-10). `revision_requested` asks AMPM for a new version. */
export const hotelProposalDecision = z.enum(["accepted", "declined", "revision_requested"]);
export type HotelProposalDecision = z.infer<typeof hotelProposalDecision>;

const isoDate = z.iso.date();

// --- Requests ---------------------------------------------------------------------------------------

/** One line of a proposal on create; `item_type` reuses the hotel_rate_items enum (data-model §6). */
export const hotelProposalLineInput = z
  .object({
    itemType: hotelRateItemType,
    description: z.string().min(1).max(2000),
    // Bounded to what numeric(14,2) holds, so an out-of-range quantity is a 422, not a column overflow.
    quantity: z.number().positive().max(999_999_999_999.99),
    unitAmount: money,
    totalAmount: money,
    clientVisible: z.boolean(),
  })
  .strict();
export type HotelProposalLineInput = z.infer<typeof hotelProposalLineInput>;

/** Staff drafts a proposal for an enquiry (§5.4: SA/HT create). The hotel is the enquiry's own, resolved
 * server-side. Both totals are entered (A-4); the margin is never entered. Starts at version 1, `draft`. */
export const hotelProposalCreateRequest = z
  .object({
    enquiryId: uuid,
    validUntil: isoDate.nullable().default(null),
    clientTotal: money,
    internalTotal: money,
    lines: z.array(hotelProposalLineInput).max(200).default([]),
  })
  .strict()
  .refine(
    (v) =>
      amountOk(v.clientTotal) &&
      amountOk(v.internalTotal) &&
      v.lines.every((l) => amountOk(l.unitAmount) && amountOk(l.totalAmount)),
    { message: "an amount is out of range", path: ["clientTotal"] },
  );
export type HotelProposalCreateRequest = z.infer<typeof hotelProposalCreateRequest>;

/** Staff edits a DRAFT proposal's terms (the service enforces the draft-only gate — AC-09). `lines`, when
 * given, replaces the whole line set (lines are owned per version). */
export const hotelProposalUpdateRequest = z
  .object({
    validUntil: isoDate.nullable().optional(),
    clientTotal: money.optional(),
    internalTotal: money.optional(),
    lines: z.array(hotelProposalLineInput).max(200).optional(),
  })
  .strict()
  .refine(
    (v) =>
      amountOk(v.clientTotal) &&
      amountOk(v.internalTotal) &&
      (v.lines ?? []).every((l) => amountOk(l.unitAmount) && amountOk(l.totalAmount)),
    { message: "an amount is out of range", path: ["clientTotal"] },
  );
export type HotelProposalUpdateRequest = z.infer<typeof hotelProposalUpdateRequest>;

/** The client's decision on a shared proposal (their own enquiry's proposal only; entitlement-gated). */
export const hotelProposalDecisionRequest = z.object({ decision: hotelProposalDecision }).strict();
export type HotelProposalDecisionRequest = z.infer<typeof hotelProposalDecisionRequest>;

export const hotelProposalListQuery = cursorQuery.extend({
  enquiryId: uuid.optional(),
  status: hotelProposalStatus.optional(),
});
export type HotelProposalListQuery = z.infer<typeof hotelProposalListQuery>;

// --- Views ------------------------------------------------------------------------------------------

const lineClientFields = {
  id: uuid,
  itemType: hotelRateItemType,
  description: z.string(),
  quantity: z.number(),
  unitAmount: money,
  totalAmount: money,
} as const;

export const hotelProposalLineClientView = z.object(lineClientFields).strict();
export type HotelProposalLineClientView = z.infer<typeof hotelProposalLineClientView>;

export const hotelProposalLineView = z
  .object({ ...lineClientFields, proposalId: uuid, clientVisible: z.boolean() })
  .strict();
export type HotelProposalLineView = z.infer<typeof hotelProposalLineView>;

/** Scalars both audiences see (all CLIENT-class). The version chain is client-visible (AC-09 transparency). */
const proposalClientScalars = {
  id: uuid,
  enquiryId: uuid,
  hotelId: uuid,
  versionNumber: z.number().int(),
  status: hotelProposalStatus,
  validUntil: isoDate.nullable(),
  clientTotal: money,
  currency: z.string(),
  documentId: uuid.nullable(),
  sharedAt: isoDateTime.nullable(),
  decidedAt: isoDateTime.nullable(),
  supersedesProposalId: uuid.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
} as const;

export const hotelProposalClientView = z
  .object({ ...proposalClientScalars, lines: z.array(hotelProposalLineClientView) })
  .strict();
export type HotelProposalClientView = z.infer<typeof hotelProposalClientView>;

export const hotelProposalInternalView = z
  .object({
    ...proposalClientScalars,
    decidedByUserId: uuid.nullable(),
    approvalId: uuid.nullable(),
    createdBy: uuid.nullable(),
    // RESTRICTED-FINANCE: present ONLY for a reader holding `consultancy.proposals.read_internal_amount`
    // (SA/HT/FA, PM assigned); ABSENT — not null — for a staff reader without it (SM), per security.md.
    internalTotal: money.optional(),
    margin: money.optional(),
    lines: z.array(hotelProposalLineView),
  })
  .strict();
export type HotelProposalInternalView = z.infer<typeof hotelProposalInternalView>;

export const hotelProposalClientPage = page(hotelProposalClientView);
export type HotelProposalClientPage = z.infer<typeof hotelProposalClientPage>;

export const hotelProposalInternalPage = page(hotelProposalInternalView);
export type HotelProposalInternalPage = z.infer<typeof hotelProposalInternalPage>;
