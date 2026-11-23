import type {
  DestinationListItemView,
  DestinationView,
  HotelCatalogueKey,
  HotelContactView,
  HotelStaffDetail,
  HotelStaffDetailView,
  HotelStaffListItem,
  HotelStaffNotesView,
  HotelStaffView,
  RoomCategoryView,
  VenueView,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import type { HotelAudience } from "./hotel-audience.js";
import { toStringList } from "./hotel-string-lists.js";
import type {
  DestinationListRow,
  DestinationRow,
  StaffHotelDetailRow,
  StaffHotelRow,
} from "./hotels-admin.repository.js";

/*
 * Staff response models, one per audience (D-171). The return types are the @ampm/core staff views, so
 * TypeScript rejects any extra field: the profile serialiser cannot carry the internal rating, notes or
 * contacts, and each restricted group is added only for an audience whose grants read it
 * (hotel-audience.ts). A Prisma Decimal becomes a number and a JSON list column (facilities, name
 * variants, cuisines) is narrowed to a string list without an `as` cast.
 */

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
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

/** A destination in the staff list (TW-20), with the count of its hotels the repository selected. */
export function toDestinationListItem(row: DestinationListRow): DestinationListItemView {
  return { ...toDestinationView(row), hotelCount: row._count.hotels };
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
    facilities: toStringList(row.facilities),
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
    facilities: toStringList(row.facilities),
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

/**
 * The D-178 columns as every staff profile reader gets them (D-171): the INTERNAL name variants and
 * booking terms included, since every staff role reads INTERNAL; never RESTRICTED-NOTES.
 */
function catalogueViewOf(row: StaffHotelRow): Pick<HotelStaffView, HotelCatalogueKey> {
  return {
    parentGroup: row.parentGroup,
    nameAliases: toStringList(row.nameAliases),
    locality: row.locality,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    mapsUrl: row.mapsUrl,
    airportName: row.airportName,
    airportDistanceKm: toNumber(row.airportDistanceKm),
    airportDriveMinutes: row.airportDriveMinutes,
    railwayStationName: row.railwayStationName,
    railwayDistanceKm: toNumber(row.railwayDistanceKm),
    railwayDriveMinutes: row.railwayDriveMinutes,
    cityCentreDistanceKm: toNumber(row.cityCentreDistanceKm),
    cityCentreDriveMinutes: row.cityCentreDriveMinutes,
    accessNotes: row.accessNotes,
    totalEventSpaceSqm: row.totalEventSpaceSqm,
    totalEventSpaceSqft: row.totalEventSpaceSqft,
    weddingBuyoutPolicy: row.weddingBuyoutPolicy,
    minRoomsWithoutBuyout: row.minRoomsWithoutBuyout,
    minNights: row.minNights,
    parallelFunctions: row.parallelFunctions,
    bookingNotes: row.bookingNotes,
    cuisines: toStringList(row.cuisines),
    isPureVegetarian: row.isPureVegetarian,
    hasSeparateVegKitchen: row.hasSeparateVegKitchen,
    servesAlcohol: row.servesAlcohol,
  };
}

/** The profile every reader of the hotel gets: no RESTRICTED-NOTES column, no contacts. */
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
    totalRooms: row.totalRooms,
    streetViewRef: row.streetViewRef,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    facilities: toStringList(row.facilities),
    ...catalogueViewOf(row),
  };
}

/** The RESTRICTED-NOTES group, for an audience that reads the internal rating and notes. */
function internalNotesOf(row: StaffHotelRow): Omit<HotelStaffNotesView, keyof HotelStaffView> {
  return { internalRating: row.internalRating, internalNotes: row.internalNotes };
}

/** A hotel in the staff list, in the model of the reader's audience. */
export function toHotelStaffListItem(
  row: StaffHotelRow,
  audience: HotelAudience,
): HotelStaffListItem {
  const profile = toHotelStaffView(row);
  return audience.notes ? { ...profile, ...internalNotesOf(row) } : profile;
}

/** The detail every reader of the hotel gets: the profile, its destination, rooms and venues. */
export function toHotelStaffDetailView(row: StaffHotelDetailRow): HotelStaffDetailView {
  return {
    ...toHotelStaffView(row),
    destination: toDestinationView(row.destination),
    rooms: row.rooms.map(toRoomCategoryView),
    venues: row.venues.map(toVenueView),
  };
}

/** The staff hotel detail in the model of the reader's audience: each restricted group only if read. */
export function toHotelStaffDetail(
  row: StaffHotelDetailRow,
  audience: HotelAudience,
): HotelStaffDetail {
  const detail = toHotelStaffDetailView(row);
  const notes = audience.notes ? internalNotesOf(row) : null;
  const contacts = audience.contacts ? row.contacts.map(toHotelContactView) : null;
  if (notes && contacts) return { ...detail, ...notes, contacts };
  if (notes) return { ...detail, ...notes };
  if (contacts) return { ...detail, contacts };
  return detail;
}
