import type {
  DestinationView,
  HotelContactView,
  HotelStaffView,
  HotelStatus,
  HotelVenueType,
  RoomCategoryView,
  VenueView,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

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
