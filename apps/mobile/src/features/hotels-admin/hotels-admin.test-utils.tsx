import type {
  DestinationView,
  HotelContactView,
  HotelStaffDetailView,
  HotelStaffView,
  MediaAssetView,
  RateCardView,
  RateItemView,
  RoomCategoryView,
  VenueView,
  VerificationView,
} from "@ampm/core";

import { failure, TEST_API_BASE } from "../../test/api";

export { failure, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for the staff hotel catalogue + photo manager: a hotel and a media asset in the shapes
 * the staff endpoints return, and a method-aware fetch that answers by path. Imported by tests only.
 */

export const HOTEL_ID = "018f0000-0000-7000-8000-0000000c0001";
export const DESTINATION_ID = "018f0000-0000-7000-8000-0000000c0002";
export const ROOM_ID = "018f0000-0000-7000-8000-0000000c0d01";
export const VENUE_ID = "018f0000-0000-7000-8000-0000000c0e01";
export const CONTACT_ID = "018f0000-0000-7000-8000-0000000c0f01";
export const RATE_CARD_ID = "018f0000-0000-7000-8000-0000000c1001";
export const RATE_ITEM_ID = "018f0000-0000-7000-8000-0000000c1101";
export const VERIFICATION_ID = "018f0000-0000-7000-8000-0000000c1201";
const UPLOADER_ID = "018f0000-0000-7000-8000-0000000c00aa";

/** A hotel as `GET /hotels-admin/hotels` returns it; override for the other states. */
export function hotelStaffViewFixture(overrides: Partial<HotelStaffView> = {}): HotelStaffView {
  return {
    id: HOTEL_ID,
    destinationId: DESTINATION_ID,
    name: "The Lakeside Palace",
    slug: "the-lakeside-palace",
    brand: null,
    starCategory: "5",
    address: null,
    latitude: null,
    longitude: null,
    descriptionClient: null,
    website: null,
    status: "active",
    demoVisible: false,
    publicShowcase: false,
    internalRating: null,
    internalNotes: null,
    totalRooms: 120,
    streetViewRef: null,
    lastVerifiedAt: null,
    ...overrides,
  };
}

/** A destination as `GET /hotels-admin/destinations` returns it. */
export function destinationViewFixture(overrides: Partial<DestinationView> = {}): DestinationView {
  return {
    id: DESTINATION_ID,
    name: "Udaipur",
    slug: "udaipur",
    region: null,
    state: "Rajasthan",
    country: "India",
    description: null,
    status: "active",
    publicVisible: true,
    ...overrides,
  };
}

/** A hotel with its (empty) nested collections, as create / update / detail return it. */
export function hotelStaffDetailViewFixture(
  overrides: Partial<HotelStaffDetailView> = {},
): HotelStaffDetailView {
  return {
    ...hotelStaffViewFixture(),
    destination: destinationViewFixture(),
    rooms: [],
    venues: [],
    contacts: [],
    ...overrides,
  };
}

/** A room category as the staff hotel detail nests it. */
export function roomCategoryViewFixture(
  overrides: Partial<RoomCategoryView> = {},
): RoomCategoryView {
  return {
    id: ROOM_ID,
    hotelId: HOTEL_ID,
    name: "Deluxe Lake View",
    roomCount: 20,
    maxOccupancy: 3,
    sizeSqm: 45,
    facilities: ["wifi", "minibar"],
    description: null,
    ...overrides,
  };
}

/** A venue as the staff hotel detail nests it. */
export function venueViewFixture(overrides: Partial<VenueView> = {}): VenueView {
  return {
    id: VENUE_ID,
    hotelId: HOTEL_ID,
    name: "Grand Ballroom",
    venueType: "ballroom",
    isIndoor: true,
    areaSqm: 500,
    capacityBanquet: 300,
    capacityTheatre: 400,
    capacityReception: 500,
    facilities: ["stage", "AV"],
    description: null,
    ...overrides,
  };
}

/** A hotel contact as the staff hotel detail nests it (RESTRICTED-CONTACT). */
export function hotelContactViewFixture(
  overrides: Partial<HotelContactView> = {},
): HotelContactView {
  return {
    id: CONTACT_ID,
    hotelId: HOTEL_ID,
    name: "Priya Sharma",
    roleTitle: "Events Manager",
    phone: "+91 98765 43210",
    email: "priya@lakeside.example",
    isPrimary: true,
    ...overrides,
  };
}

/** A rate item as a card nests it; a client-visible indicative range ₹16,000–24,000 per night. */
export function rateItemViewFixture(overrides: Partial<RateItemView> = {}): RateItemView {
  return {
    id: RATE_ITEM_ID,
    rateCardId: RATE_CARD_ID,
    itemType: "room_rate",
    roomCategoryId: null,
    venueId: null,
    amount: { minor: 1600000, currency: "INR" },
    amountMax: { minor: 2400000, currency: "INR" },
    isIndicative: true,
    unit: "per_night",
    minQuantity: null,
    inclusionsText: null,
    clientVisible: true,
    ...overrides,
  };
}

/** A rate card as `GET …/rate-cards` returns it (draft, with one item). */
export function rateCardViewFixture(overrides: Partial<RateCardView> = {}): RateCardView {
  return {
    id: RATE_CARD_ID,
    hotelId: HOTEL_ID,
    name: "Wedding season 2027",
    validFrom: null,
    validTo: null,
    currency: "INR",
    status: "draft",
    verificationId: null,
    source: null,
    internalNotes: null,
    items: [rateItemViewFixture()],
    ...overrides,
  };
}

/** A verification record as `GET …/verifications` returns it (a verified "rates" group). */
export function verificationViewFixture(
  overrides: Partial<VerificationView> = {},
): VerificationView {
  return {
    id: VERIFICATION_ID,
    hotelId: HOTEL_ID,
    fieldGroup: "rates",
    verifiedAt: "2026-11-01T09:00:00Z",
    verifiedBy: null,
    source: "phone",
    status: "verified",
    nextDueAt: null,
    notes: null,
    ...overrides,
  };
}

/** A media asset as `GET /media` returns it (staff view); a scanned-clean, internal-only photo. */
export function mediaAssetFixture(overrides: Partial<MediaAssetView> = {}): MediaAssetView {
  return {
    id: "018f0000-0000-7000-8000-0000000c0a01",
    ownerType: "hotel",
    ownerId: HOTEL_ID,
    kind: "image",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    scanStatus: "clean",
    caption: "Lobby at dusk",
    sortOrder: 0,
    visibility: "internal",
    rightsStatus: "consent_required",
    consentSourceProjectId: null,
    consentDocumentId: null,
    uploadedBy: UPLOADER_ID,
    createdAt: "2026-11-01T09:00:00Z",
    ...overrides,
  };
}

export type FetchFn = typeof fetch;
type Route = (init: RequestInit | undefined) => Response;

/** A fetch that answers by path (no base, no query), passing `init` so a route can branch on the method. */
export function routedFetch(routes: Readonly<Record<string, Route>>): FetchFn {
  return (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "").split("?")[0] ?? "";
    const route = routes[path];
    return Promise.resolve(route ? route(init) : failure("not_found", 404));
  };
}
