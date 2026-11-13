import type {
  ClientRateItemView,
  DestinationBrowseItem,
  HotelCapacityRange,
  HotelCardSummary,
  HotelCompareItem,
  HotelDetailView,
  HotelPriceRange,
  HotelRateItemType,
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

/** Venue rows carry only seating columns here (the summary select); the detail passes its richer rows too. */
type VenueCapacity = { capacityBanquet: number | null; capacityReception: number | null };

/** The rate-item types a card's indicative range is drawn from, in preference order (so units never mix). */
const PRICE_RANGE_TYPES: readonly HotelRateItemType[] = [
  "room_rate",
  "wedding_package",
  "per_plate_veg",
];

/**
 * Maps a repository row to the client response model (CP-11). The return type is the @ampm/core client
 * view, so TypeScript rejects any extra field — the structural guarantee, alongside the repository's
 * CLIENT-only select, that no RESTRICTED hotel field can reach a client (security.md).
 */
export function toHotelView(
  row: HotelRow,
  coverUrl: string | null,
  summary: HotelCardSummary,
): HotelView {
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
    // The freshness label, indicative price range and capacity range (B11) — the caller derives them from
    // the same client-visible rate cards and venue capacities the detail serves (toCardSummary).
    summary,
  };
}

export function toSavedHotelView(
  row: SavedHotelRow,
  coverUrl: string | null,
  summary: HotelCardSummary,
): SavedHotelView {
  return {
    id: row.id,
    hotel: toHotelView(row.hotel, coverUrl, summary),
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

/**
 * The hotel's amenity list for the Overview (B14): the curated Hotel.facilities column when it carries any
 * label (option A), else the union of the room and venue facilities already on the detail (option B). The
 * result is always DEDUPLICATED and a concrete list — empty when nothing is known — so the client renders
 * one keyed chip per label without repeated keys or a null check (neither the curated write path nor the
 * union guarantees uniqueness). Reads only already-client-visible facilities, so no RESTRICTED field enters.
 */
export function hotelFacilities(
  curated: unknown,
  rooms: HotelRoomClientView[],
  venues: HotelVenueClientView[],
): string[] {
  const own = toFacilities(curated);
  const combined =
    own && own.length > 0 ? own : [...rooms, ...venues].flatMap((item) => item.facilities ?? []);
  return [...new Set(combined)];
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
  const venues = row.venues.map(toVenueClientView);
  const rooms = row.rooms.map(toRoomClientView);
  return {
    ...toHotelView(row, coverFromGallery(gallery), toCardSummary(row.rateCards, row.venues)),
    rates: toRatesView(row.rateCards),
    facilities: hotelFacilities(row.facilities, rooms, venues),
    venues,
    rooms,
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
  return {
    ...toHotelView(row, null, toCardSummary(row.rateCards, row.venues)),
    rates: toRatesView(row.rateCards),
  };
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

/**
 * The card summary (B11) for one hotel: the rate-card freshness and an indicative price range derived from
 * the SAME verified/stale, client-visible items the detail shows (toRatesView), plus the venue capacity
 * range. Shared by the list/shortlist batched path and the detail/compare rows, so the card figure never
 * diverges from the detail's and never draws on an internal cost or vendor rate (security.md).
 */
export function toCardSummary(rateCards: DetailCard[], venues: VenueCapacity[]): HotelCardSummary {
  const rates = toRatesView(rateCards);
  return {
    ratesFreshness: rates.status,
    ratesAsOf: rates.asOf,
    priceRange: indicativePriceRange(rates.items),
    capacity: capacityRange(venues),
  };
}

/**
 * An indicative price range from the first present rate type in PRICE_RANGE_TYPES, so per-night, per-event
 * and per-plate amounts never mix into one range: the lowest `amount` to the highest upper bound (an item's
 * `amountMax` when it carries one, else its `amount`). Null when no card carries a client-visible item of
 * those types (then the card shows the freshness label alone — "on request" when there are no rates at all).
 */
function indicativePriceRange(items: readonly ClientRateItemView[]): HotelPriceRange | null {
  for (const itemType of PRICE_RANGE_TYPES) {
    const ofType = items.filter((item) => item.itemType === itemType);
    if (ofType.length === 0) continue;
    // itemType and unit are independent columns, so one type can carry items in different units (e.g. two
    // wedding packages, one per event and one per plate). Range only the first unit's items so a card never
    // spans a per-event and a per-plate figure as if they were comparable.
    const unit = ofType[0]!.unit;
    const sameUnit = ofType.filter((item) => item.unit === unit);
    const currency = sameUnit[0]!.amount.currency;
    const lows = sameUnit.map((item) => item.amount.minor);
    const highs = sameUnit.map((item) => (item.amountMax ?? item.amount).minor);
    return {
      min: { minor: Math.min(...lows), currency },
      max: { minor: Math.max(...highs), currency },
      unit,
    };
  }
  return null;
}

/** The seated-guest range across a hotel's venues (banquet + reception seats); null when none is known. */
function capacityRange(venues: readonly VenueCapacity[]): HotelCapacityRange | null {
  const seats = venues
    .flatMap((venue) => [venue.capacityBanquet, venue.capacityReception])
    .filter((seat): seat is number => seat != null && seat > 0);
  if (seats.length === 0) return null;
  return { min: Math.min(...seats), max: Math.max(...seats) };
}
