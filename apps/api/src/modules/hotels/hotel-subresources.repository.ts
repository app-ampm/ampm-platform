import { Injectable } from "@nestjs/common";
import type {
  HotelContactCreateRequest,
  HotelContactUpdateRequest,
  RoomCategoryCreateRequest,
  RoomCategoryUpdateRequest,
} from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import type {
  StoredRoomArea,
  StoredVenueAreas,
  VenuePatchData,
  VenueWriteData,
} from "./hotel-child-write.js";
import { stringListInput } from "./hotel-string-lists.js";
import { venueLayoutsInput } from "./hotel-venue-layouts.js";

/*
 * Writes for a hotel's room categories, venues and contacts (feature 9.1, staff), for the staff routes and
 * the rooms and venues imports alike: each write takes the columns hotel-child-write.ts maps, and an
 * optional transaction. The selects are the nested shapes the staff detail reads (HotelsAdminRepository
 * imports them; hotels-admin.view.ts maps them), so a created or updated row renders through the same
 * view mappers; the client discovery repository lists its own columns, so none of the D-178 ones reach a
 * client. `hotels.room_categories_venues.*` covers rooms and venues; `hotels.hotel_contacts.*` covers
 * contacts (RESTRICTED-CONTACT).
 */

export const ROOM_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  roomCount: true,
  maxOccupancy: true,
  sizeSqm: true,
  facilities: true,
  description: true,
  unitType: true,
  viewLabel: true,
  bedConfiguration: true,
  sizeSqft: true,
} as const satisfies Prisma.HotelRoomCategorySelect;

export const VENUE_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  venueType: true,
  isIndoor: true,
  areaSqm: true,
  capacityBanquet: true,
  capacityTheatre: true,
  capacityReception: true,
  facilities: true,
  description: true,
  setting: true,
  areaSqft: true,
  lengthM: true,
  widthM: true,
  ceilingHeightM: true,
  prefunctionAreaSqm: true,
  prefunctionAreaSqft: true,
  otherLayouts: true,
  capacityNotes: true,
} as const satisfies Prisma.HotelVenueSelect;

export const CONTACT_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  roleTitle: true,
  phone: true,
  email: true,
  isPrimary: true,
} as const;

export type RoomRow = Prisma.HotelRoomCategoryGetPayload<{ select: typeof ROOM_SELECT }>;
export type VenueRow = Prisma.HotelVenueGetPayload<{ select: typeof VENUE_SELECT }>;
export type ContactRow = Prisma.HotelContactGetPayload<{ select: typeof CONTACT_SELECT }>;

type Client = Prisma.TransactionClient;

@Injectable()
export class HotelSubresourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotelExists(hotelId: string): Promise<boolean> {
    const row = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  // --- Room categories ---

  createRoom(
    hotelId: string,
    data: RoomCategoryCreateRequest,
    actorId: string,
    tx?: Client,
  ): Promise<RoomRow> {
    return (tx ?? this.prisma).hotelRoomCategory.create({
      data: {
        ...data,
        facilities: stringListInput(data.facilities),
        hotelId,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: ROOM_SELECT,
    });
  }

  updateRoom(
    id: string,
    patch: RoomCategoryUpdateRequest,
    actorId: string,
    tx?: Client,
  ): Promise<RoomRow> {
    return (tx ?? this.prisma).hotelRoomCategory.update({
      where: { id },
      data: { ...patch, facilities: stringListInput(patch.facilities), updatedBy: actorId },
      select: ROOM_SELECT,
    });
  }

  /** The live room of this hotel with the sq ft an update's units rule reads, or null. */
  findRoomInHotel(
    hotelId: string,
    roomId: string,
  ): Promise<({ id: string } & StoredRoomArea) | null> {
    return this.prisma.hotelRoomCategory.findFirst({
      where: { id: roomId, hotelId, deletedAt: null },
      select: { id: true, sizeSqft: true },
    });
  }

  async softDeleteRoom(id: string, actorId: string): Promise<void> {
    await this.prisma.hotelRoomCategory.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  // --- Venues ---

  createVenue(
    hotelId: string,
    data: VenueWriteData,
    actorId: string,
    tx?: Client,
  ): Promise<VenueRow> {
    return (tx ?? this.prisma).hotelVenue.create({
      data: {
        ...data,
        facilities: stringListInput(data.facilities),
        otherLayouts: venueLayoutsInput(data.otherLayouts),
        hotelId,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: VENUE_SELECT,
    });
  }

  updateVenue(id: string, patch: VenuePatchData, actorId: string, tx?: Client): Promise<VenueRow> {
    return (tx ?? this.prisma).hotelVenue.update({
      where: { id },
      data: {
        ...patch,
        facilities: stringListInput(patch.facilities),
        otherLayouts: venueLayoutsInput(patch.otherLayouts),
        updatedBy: actorId,
      },
      select: VENUE_SELECT,
    });
  }

  /** The live venue of this hotel with the sq ft figures an update's units rule reads, or null. */
  findVenueInHotel(
    hotelId: string,
    venueId: string,
  ): Promise<({ id: string } & StoredVenueAreas) | null> {
    return this.prisma.hotelVenue.findFirst({
      where: { id: venueId, hotelId, deletedAt: null },
      select: { id: true, areaSqft: true, prefunctionAreaSqft: true },
    });
  }

  async softDeleteVenue(id: string, actorId: string): Promise<void> {
    await this.prisma.hotelVenue.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  // --- Contacts (RESTRICTED-CONTACT) ---

  createContact(
    hotelId: string,
    data: HotelContactCreateRequest,
    actorId: string,
    tx: Client,
  ): Promise<ContactRow> {
    return tx.hotelContact.create({
      data: { ...data, hotelId, createdBy: actorId, updatedBy: actorId },
      select: CONTACT_SELECT,
    });
  }

  updateContact(
    id: string,
    patch: HotelContactUpdateRequest,
    actorId: string,
    tx: Client,
  ): Promise<ContactRow> {
    return tx.hotelContact.update({
      where: { id },
      data: { ...patch, updatedBy: actorId },
      select: CONTACT_SELECT,
    });
  }

  /** The live contact of this hotel with the phone it stores (a repeated phone is kept as it is), or null. */
  findContactInHotel(
    hotelId: string,
    contactId: string,
  ): Promise<{ id: string; phone: string | null } | null> {
    return this.prisma.hotelContact.findFirst({
      where: { id: contactId, hotelId, deletedAt: null },
      select: { id: true, phone: true },
    });
  }

  /** The hotel's live primary contacts other than `exceptId` (one at most, by the partial unique index). */
  findLivePrimaries(
    hotelId: string,
    exceptId: string | null,
    tx: Client,
  ): Promise<{ id: string }[]> {
    return tx.hotelContact.findMany({
      where: {
        hotelId,
        isPrimary: true,
        deletedAt: null,
        ...(exceptId === null ? {} : { id: { not: exceptId } }),
      },
      select: { id: true },
    });
  }

  async demoteContacts(ids: readonly string[], actorId: string, tx: Client): Promise<void> {
    await tx.hotelContact.updateMany({
      where: { id: { in: [...ids] } },
      data: { isPrimary: false, updatedBy: actorId },
    });
  }

  async softDeleteContact(id: string, actorId: string): Promise<void> {
    await this.prisma.hotelContact.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  /** Runs `work` in one transaction, so a write and its audit (and a primary's demotion) land together. */
  transaction<T>(work: (tx: Client) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
