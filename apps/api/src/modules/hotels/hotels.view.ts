import type {
  ClientRateItemView,
  DestinationBrowseItem,
  HotelCompareItem,
  HotelDetailView,
  HotelRatesView,
  HotelRoomClientView,
  HotelVenueClientView,
  HotelView,
  MediaGalleryItem,
  SavedHotelView,
  WeddingReferenceClientItem,
} from "@ampm/core";

import { decimalToMoney } from "./hotel-rates.money.js";
import type {
  DestinationBrowseRow,
  HotelDetailRow,
  HotelRow,
  SavedHotelRow,
} from "./hotels.repository.js";

/**
 * Maps a repository row to the client response model (CP-11). The return type is the @ampm/core client
 * view, so TypeScript rejects any extra field — the structural guarantee, alongside the repository's
 * CLIENT-only select, that no RESTRICTED hotel field can reach a client (security.md).
 */
export function toHotelView(row: HotelRow, coverUrl: string | null): HotelView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    starCategory: row.starCategory,
    destination: {
      id: row.destination.id,
      name: row.destination.name,
      slug: row.destination.slug,
      region: row.destination.region,
      state: row.destination.state,
      country: row.destination.country,
    },
    address: row.address,
    description: row.descriptionClient,
    website: row.website,
    totalRooms: row.totalRooms,
    streetViewRef: row.streetViewRef,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    // A signed cover thumbnail resolved through Module N (or null) — never read from the hotel row, which
    // carries no media (the C→N boundary). The caller passes it in: a batched cover for the list/shortlist,
    // the gallery's first image for the detail, null for the media-free compare.
    coverUrl,
  };
}

export function toSavedHotelView(row: SavedHotelRow, coverUrl: string | null): SavedHotelView {
  return {
    id: row.id,
    hotel: toHotelView(row.hotel, coverUrl),
    note: row.note,
    savedAt: row.createdAt.toISOString(),
  };
}

/** A destination browse item (CP-01/02): the client destination fields plus the in-reach hotel count. */
export function toDestinationBrowseItem(row: DestinationBrowseRow): DestinationBrowseItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    region: row.region,
    state: row.state,
    country: row.country,
    hotelCount: row.hotelCount,
  };
}

type DetailCard = HotelDetailRow["rateCards"][number];
type DetailVenue = HotelDetailRow["venues"][number];
type DetailRoom = HotelDetailRow["rooms"][number];

/** The facilities_json column (a string array on write) narrowed to the client's string[] — never other JSON. */
function toFacilities(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : null;
}

/** A venue row → the client view (CP-05): every column is descriptive, so this is a straight projection. */
function toVenueClientView(venue: DetailVenue): HotelVenueClientView {
  return {
    id: venue.id,
    name: venue.name,
    venueType: venue.venueType,
    isIndoor: venue.isIndoor,
    areaSqm: venue.areaSqm,
    capacityBanquet: venue.capacityBanquet,
    capacityTheatre: venue.capacityTheatre,
    capacityReception: venue.capacityReception,
    facilities: toFacilities(venue.facilities),
    description: venue.description,
  };
}

/** A room-category row → the client view (CP-05). */
function toRoomClientView(room: DetailRoom): HotelRoomClientView {
  return {
    id: room.id,
    name: room.name,
    roomCount: room.roomCount,
    maxOccupancy: room.maxOccupancy,
    sizeSqm: room.sizeSqm,
    facilities: toFacilities(room.facilities),
    description: room.description,
  };
}

/**
 * The hotel detail: the discovery card, its client-facing freshness-labelled pricing (AC-04), the
 * client-visible gallery (AC-24.4) and the consented previous-wedding references (GP-20). The gallery is
 * resolved by Module N through MediaService and the references by the same-module HotelReferencesService;
 * both arrive already mapped to their key-free client models, so this mapper never touches `media_assets`
 * (the C→N boundary; architecture §5) nor re-projects a reference's internal governance fields.
 */
export function toHotelDetailView(
  row: HotelDetailRow,
  gallery: MediaGalleryItem[],
  references: WeddingReferenceClientItem[],
): HotelDetailView {
  return {
    ...toHotelView(row, coverFromGallery(gallery)),
    rates: toRatesView(row.rateCards),
    venues: row.venues.map(toVenueClientView),
    rooms: row.rooms.map(toRoomClientView),
    gallery,
    references,
  };
}

/** The card cover is the gallery's first image — the same photo the detail hero shows (the list cover too). */
function coverFromGallery(gallery: MediaGalleryItem[]): string | null {
  return gallery.find((item) => item.kind === "image")?.thumbnailUrl ?? null;
}

/**
 * A compare item (CP-06, feature 9.4c): the discovery card and its freshness-labelled pricing, and nothing
 * else. The same CLIENT-only projection as the detail minus the gallery and references, so the comparison
 * carries no RESTRICTED field either — compare stays a light read over the shortlist.
 */
export function toHotelCompareItem(row: HotelDetailRow): HotelCompareItem {
  // Compare is a deliberately media-free light read (it never touches Module N), so it carries no cover.
  return { ...toHotelView(row, null), rates: toRatesView(row.rateCards) };
}

/**
 * AC-04.1/.2: prefer the verified cards' client-visible items ("Verified on <asOf>"); fall back to stale
 * ones ("Stale, last checked <asOf>"), amounts still shown; with neither, rates are "on request" and no
 * amount is sent. Only the selected status's cards contribute, so verified and stale never mix.
 */
function toRatesView(cards: DetailCard[]): HotelRatesView {
  const withItems = cards.filter((card) => card.items.length > 0);
  const verified = withItems.filter((card) => card.status === "verified");
  const stale = withItems.filter((card) => card.status === "stale");
  const chosen = verified.length > 0 ? verified : stale;
  if (chosen.length === 0) return { status: "on_request", asOf: null, items: [] };
  return {
    status: verified.length > 0 ? "verified" : "stale",
    asOf: newestVerifiedAt(chosen),
    items: chosen.flatMap((card) => card.items.map(toClientRateItem)),
  };
}

function newestVerifiedAt(cards: DetailCard[]): string | null {
  const times = cards
    .map((card) => card.verification?.verifiedAt)
    .filter((date): date is Date => date != null)
    .map((date) => date.getTime());
  return times.length > 0 ? new Date(Math.max(...times)).toISOString() : null;
}

function toClientRateItem(item: DetailCard["items"][number]): ClientRateItemView {
  return {
    itemType: item.itemType,
    amount: decimalToMoney(item.amount),
    amountMax: item.amountMax ? decimalToMoney(item.amountMax) : null,
    unit: item.unit,
    inclusions: item.inclusionsText,
  };
}
