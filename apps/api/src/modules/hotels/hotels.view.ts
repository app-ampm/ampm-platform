import type {
  ClientRateItemView,
  DestinationBrowseItem,
  HotelDetailView,
  HotelRatesView,
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
export function toHotelView(row: HotelRow): HotelView {
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
  };
}

export function toSavedHotelView(row: SavedHotelRow): SavedHotelView {
  return {
    id: row.id,
    hotel: toHotelView(row.hotel),
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
  return { ...toHotelView(row), rates: toRatesView(row.rateCards), gallery, references };
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
