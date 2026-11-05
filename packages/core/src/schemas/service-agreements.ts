import { z } from "zod";

import { cursorQuery, isoDateTime, money, page, uuid } from "./common.js";

/**
 * Module B — paid-service agreements (docs/data-model.md §4, permission-matrix §5.2, GP-5).
 *
 * A `service_agreement` is the commercial contract for a paid service beyond the subscription. For
 * hotel assistance it points back to a `hotel_enquiry`; once `active` it grants the service's
 * entitlement module, which unblocks work beyond availability checking on that enquiry (AC-05.7).
 *
 * One response model per audience (security.md): the client view carries the agreement's own terms
 * (service, scope, the fee the account agreed to pay, status) — CLIENT-class — while internal
 * metadata (account id, who accepted, the evidence document, audit columns) is ABSENT from it, never
 * a hide-flag. The status machine is hand-rolled in the service-agreements module (not a
 * `@ampm/policy` STATUS_MACHINE §7); these enums only name the states.
 */

/** The stable business key of a service (data-model §4). Super-Admin may add rows within a category
 * later; the v1 set is fixed, so the contract validates against it. */
export const serviceKey = z.enum([
  "availability_check",
  "negotiation",
  "site_visit",
  "contract_review",
  "booking_assistance",
  "design",
  "vendor_coordination",
  "full_management",
]);
export type ServiceKey = z.infer<typeof serviceKey>;

/** The fixed classification that maps a service to its entitlement module (data-model §4). */
export const serviceCategory = z.enum([
  "hotel_assistance",
  "design",
  "vendor_coordination",
  "full_management",
  "other",
]);
export type ServiceCategory = z.infer<typeof serviceCategory>;

export const serviceFeeStructure = z.enum(["fixed", "percentage", "milestones"]);
export type ServiceFeeStructure = z.infer<typeof serviceFeeStructure>;

export const serviceAgreementStatus = z.enum([
  "draft",
  "sent",
  "accepted",
  "active",
  "completed",
  "cancelled",
]);
export type ServiceAgreementStatus = z.infer<typeof serviceAgreementStatus>;

/** The fee the DB column `numeric(14,2)` can hold, in minor units (paise): Rs 999,999,999,999.99. A
 * fee outside [0, this] is rejected at the edge (422) rather than overflowing the column (a 500). */
const MAX_FEE_MINOR = 99_999_999_999_999;

function feeInRange(fee: { minor: number } | undefined): boolean {
  return fee === undefined || (fee.minor >= 0 && fee.minor <= MAX_FEE_MINOR);
}

// --- Requests ---------------------------------------------------------------------------------------

/** Staff drafts an agreement (§5.2: SA/SM create, HT create for hotel-category). The fee is entered,
 * never defaulted (Q4). `hotelEnquiryId` links a hotel-assistance agreement to its enquiry (GP-5). */
export const serviceAgreementCreateRequest = z
  .object({
    accountId: uuid,
    serviceTypeId: uuid,
    hotelEnquiryId: uuid.nullable().default(null),
    scopeText: z.string().min(1).max(8000),
    fee: money,
    feeStructure: serviceFeeStructure,
    termsVersion: z.string().max(255).nullable().default(null),
  })
  .strict()
  .refine((v) => feeInRange(v.fee), { message: "fee is out of range", path: ["fee"] });
export type ServiceAgreementCreateRequest = z.infer<typeof serviceAgreementCreateRequest>;

/** Staff edits a not-yet-accepted agreement's terms (service enforces the draft/sent gate). */
export const serviceAgreementUpdateRequest = z
  .object({
    scopeText: z.string().min(1).max(8000).optional(),
    fee: money.optional(),
    feeStructure: serviceFeeStructure.optional(),
    termsVersion: z.string().max(255).nullable().optional(),
  })
  .strict()
  .refine((v) => feeInRange(v.fee), { message: "fee is out of range", path: ["fee"] });
export type ServiceAgreementUpdateRequest = z.infer<typeof serviceAgreementUpdateRequest>;

/** A staff-driven status move (issue, mark-accepted-offline, activate, complete, cancel). The client
 * accept path is a separate endpoint (entitlement-gated), not this transition. */
export const serviceAgreementTransitionRequest = z
  .object({ status: serviceAgreementStatus })
  .strict();
export type ServiceAgreementTransitionRequest = z.infer<typeof serviceAgreementTransitionRequest>;

/** The signing account accepts the agreement it was sent (CP: explicit consent captured, security.md).
 * Acceptance moves the agreement to `accepted`; a staff activation then makes it `active`. */
export const serviceAgreementAcceptRequest = z.object({ termsAccepted: z.literal(true) }).strict();
export type ServiceAgreementAcceptRequest = z.infer<typeof serviceAgreementAcceptRequest>;

export const serviceAgreementListQuery = cursorQuery.extend({
  status: serviceAgreementStatus.optional(),
  accountId: uuid.optional(),
  hotelEnquiryId: uuid.optional(),
});
export type ServiceAgreementListQuery = z.infer<typeof serviceAgreementListQuery>;

// --- Views ------------------------------------------------------------------------------------------

const agreementClientFields = {
  id: uuid,
  // The service's reference key as stored (data-model §4: `service_key` is open, Super-Admin-editable
  // data), reported as-is; the chargeable config validates against the fixed `serviceKey` enum instead.
  serviceKey: z.string(),
  serviceName: z.string(),
  category: serviceCategory,
  hotelEnquiryId: uuid.nullable(),
  projectId: uuid.nullable(),
  scopeText: z.string(),
  fee: money,
  feeStructure: serviceFeeStructure,
  termsVersion: z.string().nullable(),
  status: serviceAgreementStatus,
  acceptedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
} as const;

export const serviceAgreementClientView = z.object(agreementClientFields).strict();
export type ServiceAgreementClientView = z.infer<typeof serviceAgreementClientView>;

const agreementStaffFields = {
  ...agreementClientFields,
  accountId: uuid,
  serviceTypeId: uuid,
  acceptedByUserId: uuid.nullable(),
  documentId: uuid.nullable(),
  createdBy: uuid.nullable(),
} as const;

export const serviceAgreementStaffView = z.object(agreementStaffFields).strict();
export type ServiceAgreementStaffView = z.infer<typeof serviceAgreementStaffView>;

export const serviceAgreementClientPage = page(serviceAgreementClientView);
export type ServiceAgreementClientPage = z.infer<typeof serviceAgreementClientPage>;

export const serviceAgreementStaffPage = page(serviceAgreementStaffView);
export type ServiceAgreementStaffPage = z.infer<typeof serviceAgreementStaffPage>;
