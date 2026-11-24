import type {
  DestinationView,
  HotelRateCardStatus,
  HotelRateItemUnit,
  HotelStaffView,
  HotelStatus,
  HotelVerificationFieldGroup,
  HotelVerificationSource,
  VerificationView,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

import type { BuyoutChoice, ParallelChoice } from "./hotel-booking-terms.form";
import type { TriState } from "./hotel-form-fields";

// The rate-item type label + order are shared (used by the consultancy proposal lines too).
export { RATE_ITEM_TYPES, rateItemTypeLabel } from "@ampm/core";

/*
 * Presentation helpers for the staff hotel catalogue (H1.1). No fetching, no rules. The room, venue and
 * contact labels and summaries are in subresources.format.ts.
 */

/** A hotel's or a destination's lifecycle, in the order the editors offer it. */
export const HOTEL_STATUSES: readonly HotelStatus[] = ["draft", "active", "inactive"];

const STATUS_LABEL: Record<HotelStatus, string> = {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
};
const STATUS_TONE: Record<HotelStatus, StatusTone> = {
  draft: "neutral",
  active: "success",
  inactive: "warning",
};

export function hotelStatusLabel(status: HotelStatus): string {
  return STATUS_LABEL[status];
}
export function hotelStatusTone(status: HotelStatus): StatusTone {
  return STATUS_TONE[status];
}

/** A screen-reader summary of one hotel row. */
export function hotelRowSummary(hotel: HotelStaffView): string {
  return `${hotel.name}, ${hotelStatusLabel(hotel.status).toLowerCase()}`;
}

/** A yes / no flag as a table cell reads it (Public, Demo), in words rather than colour. */
export function yesNo(flag: boolean): string {
  return flag ? "Yes" : "No";
}

/** A destination's name with its state (e.g. "Udaipur, Rajasthan"), for the hotel editor's picker. */
export function destinationOption(destination: DestinationView): string {
  return destination.state ? `${destination.name}, ${destination.state}` : destination.name;
}

/* --- The profile's yes / no facts and booking terms (D-178): a fact the hotel has not given is said so. */

const TRI_STATE_LABEL: Record<TriState, string> = {
  unknown: "Not known",
  yes: "Yes",
  no: "No",
};

/** A yes / no fact the hotel may not have given: "Not known", "Yes" or "No". */
export function triStateLabel(state: TriState): string {
  return TRI_STATE_LABEL[state];
}

/** The buyout answers in the order the editor offers them, "Not set" first. */
export const BUYOUT_CHOICES: readonly BuyoutChoice[] = [
  "unset",
  "not_required",
  "required",
  "depends",
];

const BUYOUT_LABEL: Record<BuyoutChoice, string> = {
  unset: "Not set",
  not_required: "Not required",
  required: "Required",
  depends: "Depends",
};

export function buyoutChoiceLabel(choice: BuyoutChoice): string {
  return BUYOUT_LABEL[choice];
}

/** The parallel-functions answers in the order the editor offers them, "Not set" first. */
export const PARALLEL_CHOICES: readonly ParallelChoice[] = [
  "unset",
  "allowed",
  "not_allowed",
  "depends",
];

const PARALLEL_LABEL: Record<ParallelChoice, string> = {
  unset: "Not set",
  allowed: "Allowed",
  not_allowed: "Not allowed",
  depends: "Depends",
};

export function parallelChoiceLabel(choice: ParallelChoice): string {
  return PARALLEL_LABEL[choice];
}

/* --- Rate cards, rate items and verifications (feature 9.2). Labels only; money renders via MoneyText. */

const RATE_CARD_STATUS_LABEL: Record<HotelRateCardStatus, string> = {
  draft: "Draft",
  verified: "Verified",
  stale: "Stale",
  retired: "Retired",
};
const RATE_CARD_STATUS_TONE: Record<HotelRateCardStatus, StatusTone> = {
  draft: "neutral",
  verified: "success",
  stale: "warning",
  retired: "neutral",
};

export function rateCardStatusLabel(status: HotelRateCardStatus): string {
  return RATE_CARD_STATUS_LABEL[status];
}
export function rateCardStatusTone(status: HotelRateCardStatus): StatusTone {
  return RATE_CARD_STATUS_TONE[status];
}

const RATE_UNIT_LABEL: Record<HotelRateItemUnit, string> = {
  per_night: "per night",
  per_plate: "per plate",
  per_event: "per event",
  percent: "%",
};
// `percent` is intentionally omitted from the picker: the wire amount is INR money with no agreed
// percentage convention, so a percent unit would render a percentage as a rupee figure. Money units only.
export const RATE_UNITS: readonly HotelRateItemUnit[] = ["per_night", "per_plate", "per_event"];
export function rateUnitLabel(unit: HotelRateItemUnit): string {
  return RATE_UNIT_LABEL[unit];
}

const VERIFICATION_SOURCE_LABEL: Record<HotelVerificationSource, string> = {
  phone: "Phone",
  email: "Email",
  site_visit: "Site visit",
  website: "Website",
  contract: "Contract",
};
export const VERIFICATION_SOURCES: readonly HotelVerificationSource[] = [
  "phone",
  "email",
  "site_visit",
  "website",
  "contract",
];
export function verificationSourceLabel(source: HotelVerificationSource): string {
  return VERIFICATION_SOURCE_LABEL[source];
}

/** A verification with the day it was made, which `latestVerification` guarantees. */
export type DatedVerification = VerificationView & { readonly verifiedAt: string };

/**
 * The newest dated verification of a field group. Picked by date here, because the API orders by date
 * descending and PostgreSQL puts an undated record first.
 */
export function latestVerification(
  verifications: readonly VerificationView[],
  group: HotelVerificationFieldGroup,
): DatedVerification | undefined {
  let latest: DatedVerification | undefined;
  for (const verification of verifications) {
    const { verifiedAt } = verification;
    if (verification.fieldGroup !== group || verifiedAt === null) continue;
    if (!latest || Date.parse(verifiedAt) > Date.parse(latest.verifiedAt)) {
      latest = { ...verification, verifiedAt };
    }
  }
  return latest;
}
