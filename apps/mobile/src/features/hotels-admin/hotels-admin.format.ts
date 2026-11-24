import {
  rateItemTypeLabel,
  type DestinationView,
  type HotelRateCardStatus,
  type HotelRateItemUnit,
  type HotelStaffView,
  type HotelStatus,
  type HotelVerificationFieldGroup,
  type HotelVerificationSource,
  type RateItemView,
  type RoomCategoryView,
  type VenueView,
  type VerificationView,
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
  percent: "Percent",
};
// A `percent` item's amounts hold the percentage in hundredths (10% is 1000), the convention the Rates
// import writes and the client views read (core `ratePercentLabel`, D-184). The item sheet types it as a
// number, as it does rupees, and its row shows the percentage rather than money and a unit.
export const RATE_UNITS: readonly HotelRateItemUnit[] = [
  "per_night",
  "per_plate",
  "per_event",
  "percent",
];
export function rateUnitLabel(unit: HotelRateItemUnit): string {
  return RATE_UNIT_LABEL[unit];
}

/** The live room categories and venues of the staff hotel detail, which a rate item's links name. */
export interface RateItemPlaces {
  readonly rooms: readonly Pick<RoomCategoryView, "id" | "name">[];
  readonly venues: readonly Pick<VenueView, "id" | "name">[];
}

/** A rate item's name on its row: as shown, and as its actions speak it (no separator glyph). */
export interface RateItemName {
  readonly title: string;
  readonly spoken: string;
}

/**
 * The room category or venue an item prices, by name; "a removed room" or "a removed venue" when its
 * link names none of the hotel's live ones (a removed room keeps its id on the item). Null for an item
 * for neither, and while the hotel is not loaded, so a link is never called removed unread.
 */
function rateItemPlace(
  { roomCategoryId, venueId }: Pick<RateItemView, "roomCategoryId" | "venueId">,
  places: RateItemPlaces | undefined,
): string | null {
  if (places === undefined) return null;
  if (roomCategoryId !== null) {
    return places.rooms.find((room) => room.id === roomCategoryId)?.name ?? "a removed room";
  }
  if (venueId !== null) {
    return places.venues.find((venue) => venue.id === venueId)?.name ?? "a removed venue";
  }
  return null;
}

/**
 * A rate item's type, then the room category or venue it prices (TW-23).
 *
 * @example
 * rateItemName(suiteRate, hotel).title; // "Room rate · Lake View Suite"
 * rateItemName(suiteRate, hotel).spoken; // "Room rate for Lake View Suite"
 */
export function rateItemName(
  item: Pick<RateItemView, "itemType" | "roomCategoryId" | "venueId">,
  places: RateItemPlaces | undefined,
): RateItemName {
  const type = rateItemTypeLabel(item.itemType);
  const place = rateItemPlace(item, places);
  if (place === null) return { title: type, spoken: type };
  return { title: `${type} · ${place}`, spoken: `${type} for ${place}` };
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
