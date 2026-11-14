import type {
  DestinationView,
  HotelContactView,
  HotelStaffDetailView,
  HotelStaffView,
  RoomCategoryView,
  VenueView,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import type {
  DestinationRow,
  StaffHotelDetailRow,
  StaffHotelRow,
} from "./hotels-admin.repository.js";

/*
 * Staff response models (HT/SA). The return types are the @ampm/core staff views, so TypeScript rejects
 * any extra field — the structural guarantee, alongside the repository's explicit selects, that a staff
 * view carries exactly its audience's classes. A Prisma Decimal becomes a number and a JSON facilities
 * value is narrowed to a string list without an `as` cast.
 */

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

function toFacilities(value: Prisma.JsonValue | null): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

export function toDestinationView(row: DestinationRow): DestinationView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    region: row.region,
    state: row.state,
    country: row.country,
    description: row.description,
    status: row.status,
    publicVisible: row.publicVisible,
  };
}

type RoomRow = StaffHotelDetailRow["rooms"][number];
type VenueRow = StaffHotelDetailRow["venues"][number];
type ContactRow = StaffHotelDetailRow["contacts"][number];

export function toRoomCategoryView(row: RoomRow): RoomCategoryView {
  return {
    id: row.id,
    hotelId: row.hotelId,
    name: row.name,
    roomCount: row.roomCount,
    maxOccupancy: row.maxOccupancy,
    sizeSqm: row.sizeSqm,
    facilities: toFacilities(row.facilities),
    description: row.description,
  };
}

export function toVenueView(row: VenueRow): VenueView {
  return {
    id: row.id,
    hotelId: row.hotelId,
    name: row.name,
    venueType: row.venueType,
    isIndoor: row.isIndoor,
    areaSqm: row.areaSqm,
    capacityBanquet: row.capacityBanquet,
    capacityTheatre: row.capacityTheatre,
    capacityReception: row.capacityReception,
    facilities: toFacilities(row.facilities),
    description: row.description,
  };
}

export function toHotelContactView(row: ContactRow): HotelContactView {
  return {
    id: row.id,
    hotelId: row.hotelId,
    name: row.name,
    roleTitle: row.roleTitle,
    phone: row.phone,
    email: row.email,
    isPrimary: row.isPrimary,
  };
}

export function toHotelStaffView(row: StaffHotelRow): HotelStaffView {
  return {
    id: row.id,
    destinationId: row.destinationId,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    starCategory: row.starCategory,
    address: row.address,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    descriptionClient: row.descriptionClient,
    website: row.website,
    status: row.status,
    demoVisible: row.demoVisible,
    publicShowcase: row.publicShowcase,
    internalRating: row.internalRating,
    internalNotes: row.internalNotes,
    totalRooms: row.totalRooms,
    streetViewRef: row.streetViewRef,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    facilities: toFacilities(row.facilities),
  };
}

export function toHotelStaffDetailView(row: StaffHotelDetailRow): HotelStaffDetailView {
  return {
    ...toHotelStaffView(row),
    destination: toDestinationView(row.destination),
    rooms: row.rooms.map(toRoomCategoryView),
    venues: row.venues.map(toVenueView),
    contacts: row.contacts.map(toHotelContactView),
  };
}
