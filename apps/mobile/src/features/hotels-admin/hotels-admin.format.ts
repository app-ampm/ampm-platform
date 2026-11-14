import type {
  DestinationView,
  HotelContactView,
  HotelRateCardStatus,
  HotelRateItemUnit,
  HotelStaffView,
  HotelStatus,
  HotelVenueType,
  HotelVerificationFieldGroup,
  HotelVerificationSource,
  RoomCategoryView,
  VenueView,
  VerificationView,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

// The rate-item type label + order are shared (used by the consultancy proposal lines too).
export { RATE_ITEM_TYPES, rateItemTypeLabel } from "@ampm/core";

/* Presentation helpers for the staff hotel catalogue (H1.1). No fetching, no rules. */

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

const VENUE_TYPE_LABEL: Record<HotelVenueType, string> = {
  ballroom: "Ballroom",
  lawn: "Lawn",
  poolside: "Poolside",
  rooftop: "Rooftop",
  courtyard: "Courtyard",
  beach: "Beach",
  other: "Other",
};

export function venueTypeLabel(type: HotelVenueType): string {
  return VENUE_TYPE_LABEL[type];
}

/** A one-line summary of a room category for its list row (counts, occupancy, size). */
export function roomSummary(room: RoomCategoryView): string {
  const parts: string[] = [];
  if (room.roomCount != null)
    parts.push(`${room.roomCount} ${room.roomCount === 1 ? "room" : "rooms"}`);
  if (room.maxOccupancy != null) parts.push(`sleeps ${room.maxOccupancy}`);
  if (room.sizeSqm != null) parts.push(`${room.sizeSqm} sqm`);
  return parts.join(" · ");
}

/** A one-line summary of a venue for its list row (type, indoor/outdoor, banquet capacity). */
export function venueSummary(venue: VenueView): string {
  const parts: string[] = [venueTypeLabel(venue.venueType), venue.isIndoor ? "Indoor" : "Outdoor"];
  if (venue.capacityBanquet != null) parts.push(`${venue.capacityBanquet} banquet`);
  return parts.join(" · ");
}

/** A one-line summary of a contact for its list row (role, phone, email). */
export function contactSummary(contact: HotelContactView): string {
  const parts: string[] = [];
  if (contact.roleTitle) parts.push(contact.roleTitle);
  if (contact.phone) parts.push(contact.phone);
  if (contact.email) parts.push(contact.email);
  return parts.join(" · ");
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

const VERIFICATION_FIELD_GROUP_LABEL: Record<HotelVerificationFieldGroup, string> = {
  profile: "Profile",
  rooms: "Rooms",
  venues: "Venues",
  rates: "Rates",
  availability: "Availability",
  media: "Media",
  contacts: "Contacts",
};
export function verificationFieldGroupLabel(group: HotelVerificationFieldGroup): string {
  return VERIFICATION_FIELD_GROUP_LABEL[group];
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
