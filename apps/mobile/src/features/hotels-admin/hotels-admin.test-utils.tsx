import type { HotelStaffView, MediaAssetView } from "@ampm/core";

import { failure, TEST_API_BASE } from "../../test/api";

export { failure, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for the staff hotel catalogue + photo manager: a hotel and a media asset in the shapes
 * the staff endpoints return, and a method-aware fetch that answers by path. Imported by tests only.
 */

export const HOTEL_ID = "018f0000-0000-7000-8000-0000000c0001";
const DESTINATION_ID = "018f0000-0000-7000-8000-0000000c0002";
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
