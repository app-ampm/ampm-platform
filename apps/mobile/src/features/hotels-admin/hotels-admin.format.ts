import type { DestinationView, HotelStaffView, HotelStatus } from "@ampm/core";
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
