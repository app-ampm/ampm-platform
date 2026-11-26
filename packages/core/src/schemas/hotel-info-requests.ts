import { z } from "zod";

import { errors } from "../errors";

/*
 * Hotel information requests (D-188 §1 and §2; docs/planning/hotel-information-form-plan.md §4.2 and
 * §6.1): the words the tables, the policy's status machine and the contracts share. Keep each enum in step
 * with its database enum in apps/api/prisma/schema.prisma (a spec in apps/api checks them) and the
 * statuses with STATUS_MACHINES.hotel_info_request in @ampm/policy.
 */

/** One round: a hotel's first onboarding, or a seasonal refresh (`hotel_info_requests.kind`). */
export const hotelInfoRequestKind = z.enum(["onboarding", "refresh"]);
export type HotelInfoRequestKind = z.infer<typeof hotelInfoRequestKind>;

/** A hotel the catalogue holds, or a proposed new one (`hotel_info_requests.target`). */
export const hotelInfoRequestTarget = z.enum(["existing", "new"]);
export type HotelInfoRequestTarget = z.infer<typeof hotelInfoRequestTarget>;

/**
 * A request's status, moved as permission-matrix §7 "Hotel information request" allows. Expiry is worked
 * out from `expires_at`, never stored as a status.
 */
export const hotelInfoRequestStatus = z.enum([
  "open",
  "submitted",
  "in_review",
  "changes_requested",
  "merged",
  "rejected",
  "revoked",
]);
export type HotelInfoRequestStatus = z.infer<typeof hotelInfoRequestStatus>;

/**
 * The live statuses: a hotel, and a new hotel's normalised web address, hold at most one live request (the
 * partial unique indexes of migration 20261128000000_hotel_info_requests).
 */
export const HOTEL_INFO_REQUEST_LIVE_STATUSES = [
  "open",
  "submitted",
  "in_review",
  "changes_requested",
] as const satisfies readonly HotelInfoRequestStatus[];

/**
 * Whether a status is live.
 *
 * @example
 * isLiveHotelInfoRequestStatus("in_review"); // true
 * isLiveHotelInfoRequestStatus("merged"); // false
 */
export function isLiveHotelInfoRequestStatus(status: HotelInfoRequestStatus): boolean {
  return HOTEL_INFO_REQUEST_LIVE_STATUSES.some((live) => live === status);
}

/** What the form shows from the catalogue: nothing in version 1 (plan decision 16). */
export const hotelInfoRequestPrefillMode = z.enum(["none"]);
export type HotelInfoRequestPrefillMode = z.infer<typeof hotelInfoRequestPrefillMode>;

/**
 * What a request event records (`hotel_info_request_events.event_type`): Slice 7a's staff and System
 * events, then the identity step's (D-189 §6), whose actor is a hotel person: `code_requested` (someone
 * holding the link asked for a code: the first human step, so a link counts as opened only then; no
 * person exists yet), `person_verified` (a correct code: a new or a returning person) and
 * `person_updated` (a person changed their own name or designation). Then the form's own (D-190 §1), a
 * hotel person's too: `submitted` (a revision was submitted), `correction_requested` (a message for
 * staff after submitting), `consent_withdrawn` and `removal_requested` (a person withdrew their consent,
 * or asked to have their details removed, for a Super Admin to review). A section's autosave writes no
 * event: a request's last activity comes from its sections.
 */
export const hotelInfoRequestEventType = z.enum([
  "created",
  "link_reissued",
  "link_emailed",
  "share_recorded",
  "updated",
  "expiry_extended",
  "revoked",
  "code_requested",
  "person_verified",
  "person_updated",
  "submitted",
  "correction_requested",
  "consent_withdrawn",
  "removal_requested",
]);
export type HotelInfoRequestEventType = z.infer<typeof hotelInfoRequestEventType>;

/** Who wrote a request event: AMPM staff, a person at the hotel, or the System. */
export const hotelInfoRequestActorKind = z.enum(["staff", "hotel_person", "system"]);
export type HotelInfoRequestActorKind = z.infer<typeof hotelInfoRequestActorKind>;

/**
 * How a hotel-form code reached its person (D-189 §2; `hotel_info_request_challenges.delivery` and
 * `hotel_info_request_people.code_delivery`): sent by SMS, or shown on the page while the form cannot
 * send its own SMS (no provider, or no `SMS_HOTEL_FORM_TEMPLATE`). Only an SMS code checks the mobile.
 */
export const hotelFormCodeDelivery = z.enum(["sms", "screen"]);
export type HotelFormCodeDelivery = z.infer<typeof hotelFormCodeDelivery>;

/**
 * What a contributor consented to (`hotel_info_request_consents.kind`): the privacy notice, recorded
 * when their code is entered (D-189 §1), and the two declarations of submit (D-190 §1), each bound to the
 * submitted revision's hash: `accuracy_attestation` (7.4, always granted: submit refuses without it) and
 * `display_authorisation` (7.5, `granted` holding the Yes or the No). A CHECK requires a revision hash
 * on the declarations and forbids one on the notice.
 */
export const hotelInfoRequestConsentKind = z.enum([
  "privacy_notice",
  "accuracy_attestation",
  "display_authorisation",
]);
export type HotelInfoRequestConsentKind = z.infer<typeof hotelInfoRequestConsentKind>;

/** Who withdrew a consent (`hotel_info_request_consents.withdrawal_source`): its contributor, or staff. */
export const hotelInfoRequestWithdrawalSource = z.enum(["contributor", "staff"]);
export type HotelInfoRequestWithdrawalSource = z.infer<typeof hotelInfoRequestWithdrawalSource>;

/** A request's reference: `HIR`, the year it was created (UTC) and its number, four digits at least. */
export const HOTEL_INFO_REQUEST_REFERENCE = /^HIR-\d{4}-\d{4,}$/;

/**
 * A request's reference from its creation year and the number the sequence `hotel_info_request_ref_seq`
 * drew; the sequence never resets, so the year is only read, never part of the uniqueness.
 *
 * @example
 * hotelInfoRequestReference(2026, 1); // "HIR-2026-0001"
 * hotelInfoRequestReference(2028, 12345); // "HIR-2028-12345"
 */
export function hotelInfoRequestReference(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw errors.internal("A request reference needs a four-digit year");
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw errors.internal("A request reference needs a whole number from 1");
  }
  return `HIR-${year}-${String(sequence).padStart(4, "0")}`;
}
