import type { HotelStaffDetailView } from "@ampm/core";

/*
 * The staff hotel record (T5): the sections its tab strip offers and the header's lines. Only the
 * sections that have a route are here; T5's Overview and the split Rooms / Venues / Contacts tabs have
 * no page yet. Documents takes T5's Menus slot (menus are documents, D-187 §6), and References is
 * TW-22's tab after Media.
 */

export type HotelRecordSection = "details" | "rates" | "documents" | "media" | "references";

export interface HotelRecordTab {
  readonly value: HotelRecordSection;
  readonly label: string;
  /** The key a person needs to see the tab; a tab without one shows to everyone who reaches the record. */
  readonly readKey?: string | undefined;
}

/**
 * The record strip, in T5's order: rooms and venues, rate cards, the documents in Menus' place, media,
 * then TW-22's references. Documents shows only to a role that reads them (permission-matrix §5.3).
 */
export const HOTEL_RECORD_TABS: readonly HotelRecordTab[] = [
  { value: "details", label: "Rooms, venues & contacts" },
  { value: "rates", label: "Rate cards" },
  { value: "documents", label: "Documents", readKey: "hotels.hotel_documents.read" },
  { value: "media", label: "Media" },
  { value: "references", label: "References" },
];

/**
 * The tabs a staff member sees: those without a read key, those whose key their access holds, and the
 * open section's own, so the strip always shows where they are (before `/me` answers too).
 *
 * @example
 * visibleHotelRecordTabs(useStaffAccess(), "rates"); // Finance: no Documents tab
 */
export function visibleHotelRecordTabs(
  access: { can(key: string): boolean },
  section: HotelRecordSection,
): HotelRecordTab[] {
  return HOTEL_RECORD_TABS.filter(
    (tab) => !tab.readKey || tab.value === section || access.can(tab.readKey),
  );
}

/** The section a tab's value names, or undefined for anything else. */
export function hotelRecordSection(value: string): HotelRecordSection | undefined {
  return HOTEL_RECORD_TABS.find((tab) => tab.value === value)?.value;
}

/** The route of each section; the media manager is the record's own page. */
export const HOTEL_RECORD_PATHNAME = {
  details: "/hotels-admin/[hotelId]/details",
  rates: "/hotels-admin/[hotelId]/rates",
  documents: "/hotels-admin/[hotelId]/documents",
  media: "/hotels-admin/[hotelId]",
  references: "/hotels-admin/[hotelId]/references",
} as const satisfies Record<HotelRecordSection, string>;

/** The eyebrow over the hotel's name: "Hotels · Udaipur" once the hotel has loaded (T5). */
export function hotelRecordEyebrow(hotel: HotelStaffDetailView | undefined): string {
  return hotel ? `Hotels · ${hotel.destination.name}` : "Hotels";
}
