import {
  clientAmount,
  formatAmount,
  formatDay,
  type ClientAmount,
  type ClientRateItemView,
  type DestinationBrowseItem,
  type HotelCapacityRange,
  type HotelCardSummary,
  type HotelDestinationView,
  type HotelDetailView,
  type HotelListQuery,
  type HotelPriceRange,
  type HotelRateItemType,
  type HotelRateItemUnit,
  type HotelRatesView,
  type HotelRoomClientView,
  type HotelVenueClientView,
  type HotelVenueType,
  type HotelView,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/** The client-set discovery filters beyond destination and name (feature 9.4, CP-04). */
export type HotelFilters = Pick<
  HotelListQuery,
  "star" | "minRooms" | "minGuestCapacity" | "verifiedRatesOnly"
>;

/** How many discovery filters are active — drives the clear-filters affordance and the empty-state hint. */
export function activeFilterCount(filters: HotelFilters): number {
  return (
    (filters.star ? 1 : 0) +
    (filters.minRooms ? 1 : 0) +
    (filters.minGuestCapacity ? 1 : 0) +
    (filters.verifiedRatesOnly ? 1 : 0)
  );
}

/**
 * The compare route's `ids` query to a list (CP-06). Expo-router hands a repeated key back as an array and
 * a single one as a string, so both are normalised before splitting; the screen and hook apply the 2–4 bound.
 */
export function parseCompareIds(ids: string | string[] | undefined): string[] {
  const joined = Array.isArray(ids) ? ids.join(",") : (ids ?? "");
  return joined
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Where a hotel sits, as one line: "Udaipur, Rajasthan". */
export function destinationLabel(destination: HotelDestinationView): string {
  return [destination.name, destination.state].filter(Boolean).join(", ");
}

/** A browse destination's line: how many hotels it holds and where ("5 hotels · Rajasthan"). */
export function destinationBrowseSubtitle(item: DestinationBrowseItem): string {
  const count = hotelCountLabel(item.hotelCount, false);
  const where = item.region ?? item.state;
  return where ? `${count} · ${where}` : count;
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

/**
 * A discovery card's compact freshness chip (B11): the detail spells out "Verified on <date> by AMPM", but
 * the card has no room for the date, so it shows just the one-word state (the date lives on the detail).
 */
export function cardFreshnessChip(summary: HotelCardSummary): RateChip {
  if (summary.ratesFreshness === "verified")
    return { label: "Verified", tone: "success", dot: true };
  if (summary.ratesFreshness === "stale") return { label: "Stale", tone: "neutral", dot: false };
  return { label: "On request", tone: "info", dot: false };
}

/** The card's indicative price range as the two client amounts MoneyText renders (B11). */
export function priceRangeAmounts(range: HotelPriceRange): {
  readonly amount: ClientAmount;
  readonly amountMax: ClientAmount;
} {
  return {
    amount: clientAmount(range.min.minor, range.min.currency),
    amountMax: clientAmount(range.max.minor, range.max.currency),
  };
}

/** The unit a card's price range is quoted in ("/ night" for a room rate, else the plain unit label). */
export function priceRangeUnit(unit: HotelRateItemUnit): string {
  return unit === "per_night" ? "/ night" : rateUnitLabel(unit);
}

/** A card's seated-guest capacity as a short label (B11): "Seats 500–900", or "Seats 500" when it is one value. */
export function capacityRangeLabel(capacity: HotelCapacityRange): string {
  return capacity.min === capacity.max
    ? `Seats ${capacity.min}`
    : `Seats ${capacity.min}–${capacity.max}`;
}

/**
 * The card summary spoken for assistive tech (B11): the indicative price with its unit, the rates' freshness
 * as words, and the seating — in "<low> to <high>" form, not glyphs. The whole card is one pressable, which
 * collapses its children, so this is folded into the card's accessible name: a screen-reader user hears the
 * same at-a-glance figures a sighted user sees, without opening the detail (WCAG 1.3.1).
 */
export function cardSummaryAccessibilityLabel(summary: HotelCardSummary): string {
  const parts: string[] = [];
  if (summary.priceRange) {
    const { amount, amountMax } = priceRangeAmounts(summary.priceRange);
    parts.push(
      `${formatAmount(amount)} to ${formatAmount(amountMax)} ${rateUnitLabel(summary.priceRange.unit)}`,
    );
  }
  parts.push(
    `Rates ${summary.ratesFreshness === "on_request" ? "on request" : summary.ratesFreshness}`,
  );
  if (summary.capacity) {
    const { min, max } = summary.capacity;
    parts.push(min === max ? `Seats ${min}` : `Seats ${min} to ${max}`);
  }
  return parts.join(". ");
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

/** Google's cross-platform Maps URL: opens the Maps app when it is installed, the browser otherwise. */
const MAPS_SEARCH_URL = "https://www.google.com/maps/search/?api=1&query=";

/**
 * Where to open a hotel on a map (B13 / CP-05). A street-view reference that is already a URL opens as
 * given (an admin pasted a map or Street View link); any other reference — a place id, a plus code, a
 * "lat,lng" — is searched, as is the hotel's name and address when there is no reference. Null when there
 * is nothing to locate it by (no reference and no address), so the caller can omit the action. The client
 * view carries no latitude/longitude by design, so a map is a link out, not an embed (no provider key).
 */
export function hotelMapUrl(
  hotel: Pick<HotelView, "name" | "address" | "streetViewRef">,
): string | null {
  const ref = hotel.streetViewRef?.trim();
  if (ref) return /^https?:\/\//i.test(ref) ? ref : MAPS_SEARCH_URL + encodeURIComponent(ref);
  const address = hotel.address?.trim();
  if (!address) return null;
  return MAPS_SEARCH_URL + encodeURIComponent(`${hotel.name}, ${address}`);
}

/**
 * A URL safe to hand to the system browser from a client screen: the value only when it is an http(s)
 * URL, else null. A hotel website is URL-validated on write but NOT scheme-restricted, so a javascript:,
 * data:, tel: or app-scheme value (admin- or import-sourced) must never reach Linking.openURL — drop it.
 */
export function externalHttpUrl(value: string | null): string | null {
  const url = value?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
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
 * The hotel page's tabs, only for what the API sent: an overview when there is a description, an
 * address, a website or a mappable location, the venues and room categories when any exist, the rates
 * (always: on request is an answer too), the gallery and the previous weddings.
 */
export function hotelSections(hotel: HotelDetailView): HotelSectionOption[] {
  const sections: HotelSectionOption[] = [];
  // Mirrors exactly what HotelOverview renders — description, facilities, address, a safe website link or
  // a map link — so the tab never appears over an empty body (e.g. a whitespace-only or non-http ref).
  if (
    hotel.description ||
    hotel.facilities.length > 0 ||
    hotel.address ||
    externalHttpUrl(hotel.website) ||
    hotelMapUrl(hotel)
  )
    sections.push({ value: "overview", label: "Overview" });
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
