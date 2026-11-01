import type { HotelView, SavedHotelView } from "@ampm/core";

import type { HotelRow, SavedHotelRow } from "./hotels.repository.js";

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
