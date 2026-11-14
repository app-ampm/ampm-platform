import type { HotelDetailView, HotelVenueClientView } from "@ampm/core";

import {
  capacityRangeLabel,
  externalHttpUrl,
  galleryImages,
  hotelMapUrl,
  hotelSections,
  type HotelSection,
} from "./hotels.format";

/** Whether there is anywhere to point the client: an address, a safe website link or a map link. */
export function hasHotelLocation(hotel: HotelDetailView): boolean {
  return Boolean(hotel.address || externalHttpUrl(hotel.website) || hotelMapUrl(hotel));
}

/** A tab of the desktop hotel page (D6): every phone section except the rates, which sit beside it. */
export interface DesktopSectionOption {
  readonly value: Exclude<HotelSection, "rates">;
  readonly label: string;
  readonly badge?: number | undefined;
}

/**
 * The desktop page's tabs (D6). The rates, the location and the facilities stay in the side column at
 * every tab, so the rates are no tab here, and the overview is what the main column has to show at a
 * glance: the description and the venues, rooms and previous weddings. Every other tab is the phone's.
 */
export function desktopSections(hotel: HotelDetailView): DesktopSectionOption[] {
  const hasOverview =
    Boolean(hotel.description) ||
    hotel.venues.length > 0 ||
    hotel.rooms.length > 0 ||
    hotel.references.length > 0;
  const rest = hotelSections(hotel).flatMap((option) =>
    option.value === "rates" || option.value === "overview"
      ? []
      : [{ ...option, value: option.value }],
  );
  return hasOverview ? [{ value: "overview", label: "Overview" }, ...rest] : rest;
}

/** A tab of either layout's strip: the phone's (P4) or the desktop's (D6). */
interface SectionTab<T extends HotelSection> {
  readonly value: T;
}

/**
 * The tab a layout opens from the client's pick, which the screen holds above the phone/desktop switch
 * so it survives the window crossing 1024: the pick when this layout has that tab, else its first.
 * Picked on a phone, Rates opens the desktop's overview with the rates beside it; the pick itself is
 * kept, so turning back to the phone reopens Rates.
 */
export function openSection<T extends HotelSection>(
  tabs: readonly SectionTab<T>[],
  picked: HotelSection | undefined,
): T | undefined {
  return tabs.find((tab) => tab.value === picked)?.value ?? tabs[0]?.value;
}

/** The tab a strip reports by its value, or undefined for a value the strip does not offer. */
export function sectionOf<T extends HotelSection>(
  tabs: readonly SectionTab<T>[],
  value: string,
): T | undefined {
  return tabs.find((tab) => tab.value === value)?.value;
}

/** A section's card title on the desktop page; "Weddings here" as D6 names the previous weddings. */
const SECTION_TITLE: Readonly<Record<Exclude<HotelSection, "rates">, string>> = {
  overview: "About",
  venues: "Venues",
  rooms: "Rooms",
  gallery: "Gallery",
  video: "Video",
  weddings: "Weddings here",
};

export function desktopSectionTitle(section: Exclude<HotelSection, "rates">): string {
  return SECTION_TITLE[section];
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * The mosaic's pill (D6 "All 48 photos · 3 videos"): the client-visible photos and videos, "All" when
 * there is more than one; null when the hotel has neither.
 */
export function mediaCountLabel(hotel: HotelDetailView): string | null {
  const photos = galleryImages(hotel).length;
  const videos = hotel.videos.length;
  if (photos + videos === 0) return null;
  const parts = [photos ? plural(photos, "photo") : null, videos ? plural(videos, "video") : null];
  const counts = parts.filter(Boolean).join(" · ");
  return photos + videos > 1 ? `All ${counts}` : counts;
}

/**
 * The extra facts D6 puts under the name on a desktop: how many venues and the seating range across
 * them. Only what the API sent; the phone keeps its star and rooms chips alone.
 */
export function desktopFacts(hotel: HotelDetailView): string[] {
  return [
    hotel.venues.length > 0 ? plural(hotel.venues.length, "venue") : null,
    hotel.summary.capacity ? capacityRangeLabel(hotel.summary.capacity) : null,
  ].filter((fact): fact is string => fact !== null);
}

/** A venue's seated capacities for the venue table, one per line ("Banquet 700"); empty when unknown. */
export function venueSeatLines(venue: HotelVenueClientView): string[] {
  return [
    venue.capacityBanquet === null ? null : `Banquet ${venue.capacityBanquet}`,
    venue.capacityReception === null ? null : `Reception ${venue.capacityReception}`,
    venue.capacityTheatre === null ? null : `Theatre ${venue.capacityTheatre}`,
  ].filter((line): line is string => line !== null);
}
