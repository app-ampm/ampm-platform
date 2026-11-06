import { errors } from "@ampm/core";
import type {
  HotelEnquiryStaffUpdateRequest,
  HotelEnquiryStatus,
  HotelEnquiryStatusUpdateRequest,
  ServiceKey,
} from "@ampm/core";

import type { Principal } from "../../policy/principal.types.js";
import type { ConfigService } from "../admin/config/config.service.js";
import type { ServiceAgreementsService } from "../crm/service-agreements/service-agreements.service.js";
import type { BookingMilestonesRepository } from "./booking-milestones.repository.js";
import type { EnquiryStatusPatch } from "./enquiries.repository.js";

/**
 * The status patch for a staff transition. `confirmed` is gated by `guardConfirmedReady` in the service
 * before this runs (a done `confirmed` milestone + a signed contract, AC-05.6), so here it is a plain
 * forward move; `closed` requires an outcome and stamps `closed_at`.
 */
export function buildStatusPatch(
  request: HotelEnquiryStatusUpdateRequest,
  to: HotelEnquiryStatus,
): EnquiryStatusPatch {
  if (to === "closed") {
    if (!request.outcome) throw errors.conflict("An outcome is required to close an enquiry");
    return { status: to, outcome: request.outcome, closedAt: new Date() };
  }
  return { status: to };
}

/**
 * The enquiry transitions that represent a chargeable service (AC-05.7, R8): moving to one needs an
 * active service agreement when R8's config lists that service as chargeable. 10.2 gates `negotiating`
 * (negotiation); visit_scheduled/proposal stages join when 10.3–10.5 build them.
 */
const CHARGEABLE_TRANSITION_SERVICE: Partial<Record<HotelEnquiryStatus, ServiceKey>> = {
  negotiating: "negotiation",
};

/**
 * The AC-05.7 gate: a chargeable enquiry stage needs an active agreement. The chargeable set is
 * configuration, so AMPM can make a service free by removing its key; the active-agreement check
 * reaches Module B through its service (never its tables). A free service, or one with an active
 * agreement, passes; otherwise the move is a 409 until the agreement is active.
 */
export async function guardChargeableStage(
  config: ConfigService,
  agreements: ServiceAgreementsService,
  enquiryId: string,
  to: HotelEnquiryStatus,
): Promise<void> {
  const serviceKey = CHARGEABLE_TRANSITION_SERVICE[to];
  if (!serviceKey) return;
  const { chargeableServiceKeys } = await config.get("consultancy.chargeable_services");
  if (!chargeableServiceKeys.includes(serviceKey)) return;
  if (!(await agreements.hasActiveForEnquiry(enquiryId))) {
    throw errors.conflict(
      "This stage is a paid service and needs an active service agreement on the enquiry",
    );
  }
}

/**
 * The AC-05.6 confirmed-guard: an enquiry reaches `confirmed` only when a `confirmed` booking milestone is
 * done AND a signed contract exists (interim: a done `contract_signed` milestone carrying an uploaded
 * document). Each missing item throws its own 409 so the message names it. Only the move to `confirmed`
 * is gated; every other transition passes through.
 */
export async function guardConfirmedReady(
  milestones: BookingMilestonesRepository,
  enquiryId: string,
  to: HotelEnquiryStatus,
): Promise<void> {
  if (to !== "confirmed") return;
  if (!(await milestones.hasDoneMilestone(enquiryId, "confirmed"))) {
    throw errors.conflict("Confirming an enquiry needs a completed 'confirmed' booking milestone");
  }
  if (!(await milestones.hasSignedContract(enquiryId))) {
    throw errors.conflict("Confirming an enquiry needs a signed contract");
  }
}

const INHERENTLY_INTERNAL_EVENTS: ReadonlySet<string> = new Set([
  "sent_to_hotel",
  "hotel_response",
  "negotiation_note",
]);

/** Event types whose content is internal negotiation detail; always hidden from the client timeline. */
export function isInherentlyInternalEvent(eventType: string): boolean {
  return INHERENTLY_INTERNAL_EVENTS.has(eventType);
}

/** The defined fields of a staff enquiry update, so an omitted field is left untouched. */
export function buildStaffPatch(request: HotelEnquiryStaffUpdateRequest): {
  assignedUserId?: string | null;
  notesInternal?: string | null;
} {
  const patch: { assignedUserId?: string | null; notesInternal?: string | null } = {};
  if (request.assignedUserId !== undefined) patch.assignedUserId = request.assignedUserId;
  if (request.notesInternal !== undefined) patch.notesInternal = request.notesInternal;
  return patch;
}

/** The acting staff user's id; a non-staff principal never reaches these guarded routes. */
export function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}
