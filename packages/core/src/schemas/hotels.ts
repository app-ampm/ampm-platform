import { z } from "zod";

import { cursorQuery, isoDateTime, money, page, uuid } from "./common.js";
import { weddingReferenceClientItem } from "./hotel-references.js";
import { hotelRateItemType, hotelRateItemUnit } from "./hotel-rates.js";
import { mediaGalleryItem } from "./media.js";

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
 * A destination as the client browse shows it (CP-01/02, feature 9.4b): the client destination fields plus
 * the number of active hotels in the caller's reach (AC-04.5 — the count matches the catalogue the caller
 * can actually open: all active for a subscriber, only demo_visible for a demo prospect).
 */
export const destinationBrowseItem = hotelDestinationView
  .extend({ hotelCount: z.number().int() })
  .strict();
export type DestinationBrowseItem = z.infer<typeof destinationBrowseItem>;

/** The client destinations browse (a bounded reference set — a handful of destinations, not paginated). */
export const destinationBrowseResponse = z
  .object({ items: z.array(destinationBrowseItem) })
  .strict();
export type DestinationBrowseResponse = z.infer<typeof destinationBrowseResponse>;

/**
 * The freshness of a hotel's verified, client-visible rate card(s) (CP-05; AC-04): `verified` with `asOf`
 * renders "Verified on <asOf> by AMPM"; `stale` renders "Stale, last checked <asOf>" with amounts still
 * shown; `on_request` shows no amounts and the assistance action. Never the word "confirmed" — a confirmed
 * quotation is a Module D proposal, not discovery pricing. Availability is answered inside an enquiry (AC-04.7).
 */
export const hotelRateFreshness = z.enum(["verified", "stale", "on_request"]);
export type HotelRateFreshness = z.infer<typeof hotelRateFreshness>;

/**
 * An indicative client price range for a discovery card (B11), drawn from ONE rate type's verified/stale
 * client-visible items so units never mix: `min` the lowest amount, `max` the highest (an item's upper
 * bound when it carries one, else its amount), `unit` the shared rate unit. Derived from the same cards the
 * detail shows (security.md) — never an internal cost, margin or vendor figure.
 */
export const hotelPriceRange = z
  .object({ min: money, max: money, unit: hotelRateItemUnit })
  .strict();
export type HotelPriceRange = z.infer<typeof hotelPriceRange>;

/** A card's seated-guest capacity range (B11): min/max across the hotel's venues' banquet/reception seats. */
export const hotelCapacityRange = z
  .object({ min: z.number().int(), max: z.number().int() })
  .strict();
export type HotelCapacityRange = z.infer<typeof hotelCapacityRange>;

/**
 * The at-a-glance summary a discovery card shows (B11, CP-05/AC-04): the rate-card freshness label, an
 * indicative client price range and the venue capacity range — all derived from the same verified/stale,
 * client-visible rate cards and descriptive venue capacities the detail already serves, so the card leaks
 * nothing new. `priceRange`/`capacity` are null when there is no client-visible priced item / no known
 * capacity; `ratesFreshness` is `on_request` when no verified or stale card carries a client item.
 */
export const hotelCardSummary = z
  .object({
    ratesFreshness: hotelRateFreshness,
    ratesAsOf: isoDateTime.nullable(),
    priceRange: hotelPriceRange.nullable(),
    capacity: hotelCapacityRange.nullable(),
  })
  .strict();
export type HotelCardSummary = z.infer<typeof hotelCardSummary>;

/**
 * A hotel as a client/demo principal sees it in discovery (CP-11; permission-matrix §4, PUBLIC+CLIENT
 * classes only). Strict and flat — the list card and the detail base. No status, demo_visible,
 * public_showcase, internal_rating/notes, latitude/longitude or contacts. `summary` carries the card's
 * freshness label, indicative price range and capacity range (B11), each derived from verified,
 * client-visible rate cards and descriptive venue capacities — never an internal or vendor figure.
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
    // A short-lived signed link to a thumbnail of the hotel's primary client-visible image (the card
    // cover) — the same gated derivative the detail gallery serves, never an object key (security.md).
    // Null when the hotel has no client-eligible image, or in the media-free compare projection.
    coverUrl: z.string().nullable(),
    summary: hotelCardSummary,
  })
  .strict();
export type HotelView = z.infer<typeof hotelView>;

/** One line of a hotel's client-facing rate card (CP-05): an amount or indicative range, its unit and inclusions. */
export const clientRateItemView = z
  .object({
    itemType: hotelRateItemType,
    amount: money, // the single value, or the lower bound of an indicative range
    amountMax: money.nullable(), // the upper bound of an indicative range
    unit: hotelRateItemUnit,
    inclusions: z.string().nullable(),
  })
  .strict();
export type ClientRateItemView = z.infer<typeof clientRateItemView>;

export const hotelRatesView = z
  .object({
    status: hotelRateFreshness,
    asOf: isoDateTime.nullable(),
    items: z.array(clientRateItemView),
  })
  .strict();
export type HotelRatesView = z.infer<typeof hotelRatesView>;

/** Function/event venue kinds (HotelVenueType in the Prisma schema; keep the two in step). */
export const hotelVenueType = z.enum([
  "ballroom",
  "lawn",
  "poolside",
  "rooftop",
  "courtyard",
  "beach",
  "other",
]);
export type HotelVenueType = z.infer<typeof hotelVenueType>;

/** A free-text list of amenities a client sees on a venue or room (facilities_json; read-only output). */
const facilitiesClientView = z.array(z.string());

/**
 * A function/event venue a client sees on the hotel detail (CP-05 "Venues"): its kind, whether it is
 * indoor, its area and its seated/standing capacities, the amenities and a short note. Every field is
 * descriptive (PUBLIC/CLIENT) — a venue carries no restricted field — and strict so nothing can leak.
 */
export const hotelVenueClientView = z
  .object({
    id: uuid,
    name: z.string(),
    venueType: hotelVenueType,
    isIndoor: z.boolean(),
    areaSqm: z.number().int().nullable(),
    capacityBanquet: z.number().int().nullable(),
    capacityTheatre: z.number().int().nullable(),
    capacityReception: z.number().int().nullable(),
    facilities: facilitiesClientView.nullable(),
    description: z.string().nullable(),
  })
  .strict();
export type HotelVenueClientView = z.infer<typeof hotelVenueClientView>;

/**
 * A room category a client sees on the hotel detail (CP-05 "Rooms"): its name, the number of rooms, the
 * maximum occupancy, the size, the amenities and a short note. All descriptive (PUBLIC/CLIENT), strict.
 */
export const hotelRoomClientView = z
  .object({
    id: uuid,
    name: z.string(),
    roomCount: z.number().int().nullable(),
    maxOccupancy: z.number().int().nullable(),
    sizeSqm: z.number().int().nullable(),
    facilities: facilitiesClientView.nullable(),
    description: z.string().nullable(),
  })
  .strict();
export type HotelRoomClientView = z.infer<typeof hotelRoomClientView>;

/**
 * The hotel detail (CP-05): the discovery card, its indicative freshness-labelled pricing, the venues and
 * room categories a planner weighs, the client-visible gallery, and the consented previous-wedding
 * references. `gallery` holds only the media at or below the caller's visibility level (AC-24.4), each a
 * signed link to a metadata-stripped derivative — never an object key (security.md). `references` holds
 * only the `client_visible` references whose consent is on file (GP-20), each the social-proof content
 * alone (no internal project/consent key).
 */
export const hotelDetailView = hotelView
  .extend({
    rates: hotelRatesView,
    venues: z.array(hotelVenueClientView),
    rooms: z.array(hotelRoomClientView),
    gallery: z.array(mediaGalleryItem),
    references: z.array(weddingReferenceClientItem),
  })
  .strict();
export type HotelDetailView = z.infer<typeof hotelDetailView>;

/**
 * One hotel as the client compare shows it (CP-06, feature 9.4c): the discovery card and its indicative
 * freshness-labelled pricing — the fields a planner weighs side by side. Deliberately no gallery or
 * references (rich content, not comparison data), so compare stays a light read over the shortlist.
 */
export const hotelCompareItem = hotelView.extend({ rates: hotelRatesView }).strict();
export type HotelCompareItem = z.infer<typeof hotelCompareItem>;

/** A compare request holds 2 to 4 distinct saved hotels (CP-06); the client picker and screen share these. */
export const HOTEL_COMPARE_MIN = 2;
export const HOTEL_COMPARE_MAX = 4;

/**
 * Compare a handful of the caller's saved hotels by id (CP-06). `ids` is a comma-separated list of 2 to 4
 * DISTINCT hotel ids; only ids on the caller's own shortlist and in reach are returned (denial equals
 * absence), in the order asked. Scoped to saved_hotels — a view over the shortlist, not an open multi-hotel
 * fetch. Ids are lower-cased so a valid but non-canonical-case uuid still matches the stored (lower-case)
 * id in the service's set/map lookups, and duplicates are a 400 — a comparison is of distinct hotels, not
 * one hotel against itself.
 */
export const hotelCompareQuery = z
  .object({
    ids: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(uuid)
          .min(HOTEL_COMPARE_MIN)
          .max(HOTEL_COMPARE_MAX)
          .refine((ids) => new Set(ids).size === ids.length, {
            message: "hotel ids must be distinct",
          }),
      ),
  })
  .strict();
export type HotelCompareQuery = z.infer<typeof hotelCompareQuery>;

export const hotelCompareResponse = z.object({ items: z.array(hotelCompareItem) }).strict();
export type HotelCompareResponse = z.infer<typeof hotelCompareResponse>;

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
  // Discovery filters (feature 9.4, AC-04.6). `star` matches the star category exactly; `minRooms` keeps
  // hotels with at least that many rooms (accommodation); `minGuestCapacity` keeps hotels with a venue that
  // seats at least that many (banquet or reception — event capacity); `verifiedRatesOnly` keeps hotels that
  // currently show verified, client-visible pricing. Each narrows the catalogue; reach scoping still applies.
  star: z.string().trim().max(50).optional(),
  minRooms: z.coerce.number().int().min(0).optional(),
  minGuestCapacity: z.coerce.number().int().min(0).optional(),
  verifiedRatesOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
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

/**
 * Every hotel id on the account's shortlist, in one bounded read (a client's shortlist is a handful to a
 * few dozen hotels). The discovery cards and the hotel page use it for a reliable "saved" state: scanning
 * the first page of the paginated shortlist missed a hotel saved further down (B12/B12b), this does not.
 */
export const savedHotelIdsResponse = z.object({ ids: z.array(uuid) }).strict();
export type SavedHotelIdsResponse = z.infer<typeof savedHotelIdsResponse>;

/**
 * A client edits their own free-text note on a shortlisted hotel (D7 "My selection"). Client-authored and
 * client-visible; the service trims it and stores blank as null (a cleared note), so "no note" is one state.
 */
export const savedHotelNoteUpdateRequest = z
  .object({ note: z.string().max(1000).nullable() })
  .strict();
export type SavedHotelNoteUpdateRequest = z.infer<typeof savedHotelNoteUpdateRequest>;
