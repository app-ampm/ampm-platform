import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";

/*
 * Contracts for hotel discovery (Module C "Hotel intelligence"; docs/data-model.md §5, feature set C).
 * A client/demo principal with the hotel_discovery entitlement browses/searches hotels, opens one, and
 * saves it to the account shortlist. Every field here is PUBLIC or CLIENT class (permission-matrix §4):
 * the internal rating/notes (RESTRICTED-NOTES) and all hotel contacts (RESTRICTED-CONTACT) are
 * structurally absent, and each client view is .strict() so none can leak (security.md: one response
 * model per audience, never a hidden flag). Entitlement gating and demo isolation are NOT in these
 * contracts — the reach (all_hotels vs demo_hotels) is a computed @ampm/policy decision and a repository
 * scope (hotels.demo_visible, status=active), never a field or a query param on the wire.
 */

/** The destination a hotel sits in, as a client sees it (destinations.*, CLIENT; data-model.md §5). */
export const hotelDestinationView = z
  .object({
    id: uuid,
    name: z.string(),
    slug: z.string(),
    region: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string(),
  })
  .strict();
export type HotelDestinationView = z.infer<typeof hotelDestinationView>;

/**
 * A hotel as a client/demo principal sees it in discovery (CP-11; permission-matrix §4, PUBLIC+CLIENT
 * classes only). Strict and flat — the list card and the detail base. No status, demo_visible,
 * public_showcase, internal_rating/notes, latitude/longitude or contacts. An indicative price range is a
 * later increment (derived from verified, client-visible rate cards — Module C rate tables, deferred).
 */
export const hotelView = z
  .object({
    id: uuid,
    slug: z.string(),
    name: z.string(),
    brand: z.string().nullable(),
    starCategory: z.string().nullable(),
    destination: hotelDestinationView,
    address: z.string().nullable(),
    description: z.string().nullable(), // hotels.description_client (CLIENT; data-model.md §5)
    website: z.string().nullable(),
    totalRooms: z.number().int().nullable(),
    streetViewRef: z.string().nullable(), // map / street-view reference (Q9; data-model.md §5)
    lastVerifiedAt: isoDateTime.nullable(), // freshness label (data-model.md §5)
  })
  .strict();
export type HotelView = z.infer<typeof hotelView>;

/**
 * Search/browse hotels (CP discovery). Cursor-paginated by hotel id; `destinationId` filters to one
 * destination, `q` searches the hotel name. The cursor is a UUID, validated at the edge so a malformed
 * cursor is a 400, not a Postgres uuid-cast 500 (as subscriptionListQuery). Reach is applied in the
 * repository from the principal's entitlements — never a param a client sets.
 */
export const hotelListQuery = cursorQuery.extend({
  cursor: uuid.optional(),
  destinationId: uuid.optional(),
  q: z.string().trim().max(255).optional(),
});
export type HotelListQuery = z.infer<typeof hotelListQuery>;

export const hotelPage = page(hotelView);
export type HotelPage = z.infer<typeof hotelPage>;

/**
 * A saved hotel as its owner sees it (CLIENT). Strict; embeds the hotel summary so the shortlist renders
 * without an N+1. No account_id / saved_by_user_id / project_id on the wire — internal ownership plumbing.
 */
export const savedHotelView = z
  .object({
    id: uuid,
    hotel: hotelView,
    note: z.string().nullable(),
    savedAt: isoDateTime, // created_at (standard column, data-model.md §1)
  })
  .strict();
export type SavedHotelView = z.infer<typeof savedHotelView>;

/** List the account's saved hotels (cursor-paginated by saved_hotels id). */
export const savedHotelListQuery = cursorQuery.extend({
  cursor: uuid.optional(),
});
export type SavedHotelListQuery = z.infer<typeof savedHotelListQuery>;

export const savedHotelPage = page(savedHotelView);
export type SavedHotelPage = z.infer<typeof savedHotelPage>;

/**
 * The acknowledgement a client gets after removing a hotel from the shortlist (DELETE is idempotent —
 * removing a hotel that is not saved is a no-op and still returns its id).
 */
export const savedHotelRemovedResponse = z.object({ hotelId: uuid }).strict();
export type SavedHotelRemovedResponse = z.infer<typeof savedHotelRemovedResponse>;
