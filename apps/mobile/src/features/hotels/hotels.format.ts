import {
  clientAmount,
  formatDay,
  type ClientAmount,
  type ClientRateItemView,
  type HotelDestinationView,
  type HotelDetailView,
  type HotelRateItemType,
  type HotelRateItemUnit,
  type HotelRatesView,
  type HotelRoomClientView,
  type HotelVenueClientView,
  type HotelVenueType,
  type HotelView,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/** Where a hotel sits, as one line: "Udaipur, Rajasthan". */
export function destinationLabel(destination: HotelDestinationView): string {
  return [destination.name, destination.state].filter(Boolean).join(", ");
}

/** "84 rooms". */
export function roomsLabel(rooms: number): string {
  return rooms === 1 ? "1 room" : `${rooms} rooms`;
}

/** The star category as its chip reads it: "5-star". */
export function starLabel(starCategory: string): string {
  return `${starCategory}-star`;
}

/** A card's data line: where the hotel is and its size when known ("Udaipur, Rajasthan · 84 rooms"). */
export function hotelMetaLine(hotel: HotelView): string {
  const rooms = hotel.totalRooms === null ? null : roomsLabel(hotel.totalRooms);
  return [destinationLabel(hotel.destination), rooms].filter(Boolean).join(" · ");
}

/** "14 hotels", or "50+ hotels" when the page stops before the end of the list. */
export function hotelCountLabel(count: number, hasMore: boolean): string {
  if (hasMore) return `${count}+ hotels`;
  return count === 1 ? "1 hotel" : `${count} hotels`;
}

/**
 * What the search says to an account without hotel discovery (a client who has not paid yet, or one
 * whose subscription lapsed), and when the server refuses a search with its 404 (denial equals
 * absence): the same words, so a refusal never reads as a fault to retry.
 */
export const DISCOVERY_CLOSED = {
  icon: "lock",
  title: "Subscribe to unlock hotel discovery",
  description: "Hotel discovery opens once your plan is active.",
} as const;

/** The search's sign-in prompt, whether `/me` or the search itself finds the session gone. */
export const DISCOVERY_SIGN_IN = { title: "Sign in to browse hotels" } as const;

/**
 * The destinations the filter chips offer: those of the hotels on screen, plus the chosen one (so it
 * can be cleared even when a new search returns none of its hotels), by name.
 */
export function destinationOptions(
  hotels: readonly HotelView[],
  selected: HotelDestinationView | null,
): HotelDestinationView[] {
  const byId = new Map<string, HotelDestinationView>();
  if (selected) byId.set(selected.id, selected);
  for (const hotel of hotels) {
    if (!byId.has(hotel.destination.id)) byId.set(hotel.destination.id, hotel.destination);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const RATE_ITEM_LABEL: Readonly<Record<HotelRateItemType, string>> = {
  room_rate: "Room",
  venue_rental: "Venue rental",
  per_plate_veg: "Per plate, veg",
  per_plate_non_veg: "Per plate, non-veg",
  wedding_package: "Wedding package",
  beverage_package: "Beverage package",
  service_charge: "Service charge",
  tax: "Taxes",
  other: "Other",
};

const RATE_UNIT_LABEL: Readonly<Record<HotelRateItemUnit, string>> = {
  per_night: "per night",
  per_plate: "per plate",
  per_event: "per event",
  percent: "on the total",
};

export function rateItemLabel(type: HotelRateItemType): string {
  return RATE_ITEM_LABEL[type];
}

export function rateUnitLabel(unit: HotelRateItemUnit): string {
  return RATE_UNIT_LABEL[unit];
}

/** A rate item's amounts as client amounts, the only kind MoneyText takes. */
export function rateAmounts(item: ClientRateItemView): {
  readonly amount: ClientAmount;
  readonly amountMax: ClientAmount | null;
} {
  return {
    amount: clientAmount(item.amount.minor, item.amount.currency),
    amountMax: item.amountMax ? clientAmount(item.amountMax.minor, item.amountMax.currency) : null,
  };
}

/** A percentage item ("18%", "18–20%"): its amounts hold the percentage in hundredths. */
export function percentLabel(item: ClientRateItemView): string {
  const low = item.amount.minor / 100;
  const high = item.amountMax ? item.amountMax.minor / 100 : low;
  return high === low ? `${low}%` : `${low}–${high}%`;
}

/** Whether the rates carry amounts: verified or stale items (on request never shows amounts, AC-04). */
export function hasRateAmounts(rates: HotelRatesView): boolean {
  return rates.status !== "on_request" && rates.items.length > 0;
}

export interface RateChip {
  readonly label: string;
  readonly tone: StatusTone;
  readonly dot: boolean;
}

/**
 * The rates' freshness as its chip (guide §8): verified is peacock with a dot, stale is the neutral
 * chip (its amounts still show), on request is the indicative outline. Never "confirmed": a confirmed
 * price is a proposal, not discovery pricing (hotelRatesView).
 */
export function rateFreshnessChip(rates: HotelRatesView): RateChip {
  const day = rates.asOf ? formatDay(rates.asOf) : null;
  if (rates.status === "verified") {
    const label = day ? `Verified on ${day} by AMPM` : "Verified by AMPM";
    return { label, tone: "success", dot: true };
  }
  if (rates.status === "stale") {
    return { label: day ? `Stale · checked ${day}` : "Stale", tone: "neutral", dot: false };
  }
  return { label: "Rates on request", tone: "info", dot: false };
}

const HEADLINE_TYPES: readonly HotelRateItemType[] = ["room_rate", "wedding_package"];

/** The sticky footer's one price: the room rate, else the wedding package, else the first amount. */
export function headlineRate(rates: HotelRatesView): ClientRateItemView | null {
  if (!hasRateAmounts(rates)) return null;
  const priced = rates.items.filter((item) => item.unit !== "percent");
  for (const type of HEADLINE_TYPES) {
    const match = priced.find((item) => item.itemType === type);
    if (match) return match;
  }
  return priced[0] ?? null;
}

/** What the footer's price is for: "per room / night", "Wedding package, per event"; stale says so. */
export function headlineCaption(item: ClientRateItemView, rates: HotelRatesView): string {
  const unit =
    item.itemType === "room_rate" && item.unit === "per_night"
      ? "per room / night"
      : `${rateItemLabel(item.itemType)}, ${rateUnitLabel(item.unit)}`;
  return rates.status === "stale" ? `Stale · ${unit}` : unit;
}

const VENUE_TYPE_LABEL: Readonly<Record<HotelVenueType, string>> = {
  ballroom: "Ballroom",
  lawn: "Lawn",
  poolside: "Poolside",
  rooftop: "Rooftop",
  courtyard: "Courtyard",
  beach: "Beach",
  other: "Venue",
};

export function venueTypeLabel(type: HotelVenueType): string {
  return VENUE_TYPE_LABEL[type];
}

/** A venue's type and setting as one line: "Ballroom · Indoor". */
export function venueKindLine(venue: HotelVenueClientView): string {
  return `${venueTypeLabel(venue.venueType)} · ${venue.isIndoor ? "Indoor" : "Outdoor"}`;
}

/** A venue's capacities and area, most-used first; "" when none are known (so the caller can omit it). */
export function venueCapacities(venue: HotelVenueClientView): string {
  return [
    venue.capacityBanquet === null ? null : `Banquet ${venue.capacityBanquet}`,
    venue.capacityReception === null ? null : `Reception ${venue.capacityReception}`,
    venue.capacityTheatre === null ? null : `Theatre ${venue.capacityTheatre}`,
    venue.areaSqm === null ? null : `${venue.areaSqm} m²`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A room category's size line: "40 rooms · Sleeps 3 · 45 m²" (only the known parts; "" when none). */
export function roomMetaLine(room: HotelRoomClientView): string {
  return [
    room.roomCount === null ? null : roomsLabel(room.roomCount),
    room.maxOccupancy === null ? null : `Sleeps ${room.maxOccupancy}`,
    room.sizeSqm === null ? null : `${room.sizeSqm} m²`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A facilities list as one line, or null when there are none: "Wi-Fi · Parking · Spa". */
export function facilitiesLine(facilities: readonly string[] | null): string | null {
  if (!facilities || facilities.length === 0) return null;
  return facilities.join(" · ");
}

export type HotelSection = "overview" | "venues" | "rooms" | "rates" | "gallery" | "weddings";

export interface HotelSectionOption {
  readonly value: HotelSection;
  readonly label: string;
  readonly badge?: number | undefined;
}

/** The pictures a client can open: images only (a video has no web derivative to show, AC-24.1). */
export function galleryImages(hotel: HotelDetailView): HotelDetailView["gallery"] {
  return hotel.gallery.filter((item) => item.kind === "image");
}

/**
 * The hotel page's tabs, only for what the API sent: an overview when there is a description or an
 * address, the venues and room categories when any exist, the rates (always: on request is an answer
 * too), the gallery and the previous weddings.
 */
export function hotelSections(hotel: HotelDetailView): HotelSectionOption[] {
  const sections: HotelSectionOption[] = [];
  if (hotel.description || hotel.address) sections.push({ value: "overview", label: "Overview" });
  if (hotel.venues.length > 0)
    sections.push({ value: "venues", label: "Venues", badge: hotel.venues.length });
  if (hotel.rooms.length > 0)
    sections.push({ value: "rooms", label: "Rooms", badge: hotel.rooms.length });
  sections.push({ value: "rates", label: "Rates" });
  const images = galleryImages(hotel).length;
  if (images > 0) sections.push({ value: "gallery", label: "Gallery", badge: images });
  const weddings = hotel.references.length;
  if (weddings > 0) sections.push({ value: "weddings", label: "Weddings", badge: weddings });
  return sections;
}
