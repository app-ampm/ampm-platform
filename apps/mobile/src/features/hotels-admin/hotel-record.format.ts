import type { HotelStaffDetailView } from "@ampm/core";

/*
 * The staff hotel record (T5): the sections its tab strip offers and the header's lines. Only the
 * sections that have a route are here; T5's Overview, Menus and the split Rooms / Venues / Contacts tabs
 * have no page yet. References is TW-22's tab after Media.
 */

export type HotelRecordSection = "details" | "rates" | "media" | "references";

export interface HotelRecordTab {
  readonly value: HotelRecordSection;
  readonly label: string;
}

/** The record strip, in T5's order: rooms and venues, rate cards, media, then TW-22's references. */
export const HOTEL_RECORD_TABS: readonly HotelRecordTab[] = [
  { value: "details", label: "Rooms, venues & contacts" },
  { value: "rates", label: "Rate cards" },
  { value: "media", label: "Media" },
  { value: "references", label: "References" },
];

/** The section a tab's value names, or undefined for anything else. */
export function hotelRecordSection(value: string): HotelRecordSection | undefined {
  return HOTEL_RECORD_TABS.find((tab) => tab.value === value)?.value;
}

/** The route of each section; the media manager is the record's own page. */
export const HOTEL_RECORD_PATHNAME = {
  details: "/hotels-admin/[hotelId]/details",
  rates: "/hotels-admin/[hotelId]/rates",
  media: "/hotels-admin/[hotelId]",
  references: "/hotels-admin/[hotelId]/references",
} as const satisfies Record<HotelRecordSection, string>;

/** The eyebrow over the hotel's name: "Hotels · Udaipur" once the hotel has loaded (T5). */
export function hotelRecordEyebrow(hotel: HotelStaffDetailView | undefined): string {
  return hotel ? `Hotels · ${hotel.destination.name}` : "Hotels";
}
