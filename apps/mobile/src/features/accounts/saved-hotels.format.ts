import { formatDay, type SavedHotelStaffHotel, type SavedHotelStaffView } from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

import { hotelStatusLabel, hotelStatusTone } from "../hotels-admin/hotels-admin.format";
import { starLabel } from "../hotels/hotels.format";

/*
 * Presentation helpers for the staff read of clients' saved hotels (the client hub's panel, the
 * all-clients list and a hotel's "Saved by" panel in the catalogue). No fetching, no rules.
 */

/** Where the hotel is and its stars: "Udaipur · 5-star", or the destination alone. */
export function savedHotelPlace(hotel: SavedHotelStaffHotel): string {
  return hotel.starCategory
    ? `${hotel.destinationName} · ${starLabel(hotel.starCategory)}`
    : hotel.destinationName;
}

/** The client's note as the row quotes it: “Loved the lawn”; null when they left none. */
export function savedHotelNote(note: string | null): string | null {
  return note ? `“${note}”` : null;
}

/** The day the client saved it, as data: "21 NOV 2026". */
export function savedHotelDay(savedAt: string): string {
  return formatDay(savedAt, { style: "data" });
}

/**
 * The chip a hotel the client can no longer open carries (draft or inactive in the catalogue); null for
 * an active hotel, which needs no chip.
 */
export function savedHotelStatusChip(
  hotel: SavedHotelStaffHotel,
): { readonly label: string; readonly tone: StatusTone } | null {
  if (hotel.status === "active") return null;
  return { label: hotelStatusLabel(hotel.status), tone: hotelStatusTone(hotel.status) };
}

/**
 * A screen-reader summary of one saved hotel; `withClient` names the client first, for the list that
 * spans every client.
 */
export function savedHotelSummary(item: SavedHotelStaffView, withClient = false): string {
  const parts = [
    withClient ? item.account.name : null,
    item.hotel.name,
    savedHotelPlace(item.hotel),
    savedHotelStatusChip(item.hotel)?.label ?? null,
    item.note ? `note: ${item.note}` : null,
    `saved ${formatDay(item.savedAt)}`,
  ];
  return parts.filter((part): part is string => part !== null).join(", ");
}

/** "Saved hotels · 6", with a "+" while more pages wait beyond the loaded ones. */
export function savedHotelsCount(label: string, count: number, hasMore: boolean): string {
  return `${label} · ${count}${hasMore ? "+" : ""}`;
}

/**
 * A hotel's "Saved by" heading: "Saved by 3 clients", "Saved by 1 client", "Saved by 50+ clients" while
 * more pages wait, or "Saved by no clients yet". A client saves a hotel once, so each save is a client.
 */
export function savedByClientsHeading(count: number, hasMore: boolean): string {
  if (count === 0 && !hasMore) return "Saved by no clients yet";
  const plus = hasMore ? "+" : "";
  return `Saved by ${count}${plus} ${count === 1 && !hasMore ? "client" : "clients"}`;
}

/** A screen-reader summary of one client's save of the hotel the page is about. */
export function savedByClientSummary(item: SavedHotelStaffView): string {
  const parts = [
    item.account.name,
    item.note ? `note: ${item.note}` : null,
    `saved ${formatDay(item.savedAt)}`,
  ];
  return parts.filter((part): part is string => part !== null).join(", ");
}
