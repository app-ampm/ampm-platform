import { Injectable } from "@nestjs/common";
import type {
  HotelContactCreateRequest,
  HotelContactUpdateRequest,
  RoomCategoryCreateRequest,
  RoomCategoryUpdateRequest,
  VenueCreateRequest,
  VenueUpdateRequest,
} from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { facilitiesInput } from "./hotel-facilities.js";

/*
 * Writes for a hotel's room categories, venues and contacts (feature 9.1, staff). The selects match the
 * nested shapes the staff detail reads (hotels-admin.view.ts maps them), so a created/updated row renders
 * through the same view mappers. `hotels.room_categories_venues.*` covers rooms and venues;
 * `hotels.hotel_contacts.*` covers contacts (contacts are RESTRICTED-CONTACT).
 */

const ROOM_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  roomCount: true,
  maxOccupancy: true,
  sizeSqm: true,
  facilities: true,
  description: true,
} as const;

const VENUE_SELECT = {
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
} as const;

const CONTACT_SELECT = {
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
    request: RoomCategoryCreateRequest,
    actorId: string,
  ): Promise<RoomRow> {
    return this.prisma.hotelRoomCategory.create({
      data: {
        ...request,
        facilities: facilitiesInput(request.facilities),
        hotelId,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: ROOM_SELECT,
    });
  }

  updateRoom(id: string, patch: RoomCategoryUpdateRequest, actorId: string): Promise<RoomRow> {
    return this.prisma.hotelRoomCategory.update({
      where: { id },
      data: { ...patch, facilities: facilitiesInput(patch.facilities), updatedBy: actorId },
      select: ROOM_SELECT,
    });
  }

  findRoomInHotel(hotelId: string, roomId: string): Promise<{ id: string } | null> {
    return this.prisma.hotelRoomCategory.findFirst({
      where: { id: roomId, hotelId, deletedAt: null },
      select: { id: true },
    });
  }

  async softDeleteRoom(id: string, actorId: string): Promise<void> {
    await this.prisma.hotelRoomCategory.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  // --- Venues ---

  createVenue(hotelId: string, request: VenueCreateRequest, actorId: string): Promise<VenueRow> {
    return this.prisma.hotelVenue.create({
      data: {
        ...request,
        facilities: facilitiesInput(request.facilities),
        hotelId,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: VENUE_SELECT,
    });
  }

  updateVenue(id: string, patch: VenueUpdateRequest, actorId: string): Promise<VenueRow> {
    return this.prisma.hotelVenue.update({
      where: { id },
      data: { ...patch, facilities: facilitiesInput(patch.facilities), updatedBy: actorId },
      select: VENUE_SELECT,
    });
  }

  findVenueInHotel(hotelId: string, venueId: string): Promise<{ id: string } | null> {
    return this.prisma.hotelVenue.findFirst({
      where: { id: venueId, hotelId, deletedAt: null },
      select: { id: true },
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
    request: HotelContactCreateRequest,
    actorId: string,
  ): Promise<ContactRow> {
    return this.prisma.hotelContact.create({
      data: { ...request, hotelId, createdBy: actorId, updatedBy: actorId },
      select: CONTACT_SELECT,
    });
  }

  updateContact(
    id: string,
    patch: HotelContactUpdateRequest,
    actorId: string,
  ): Promise<ContactRow> {
    return this.prisma.hotelContact.update({
      where: { id },
      data: { ...patch, updatedBy: actorId },
      select: CONTACT_SELECT,
    });
  }

  findContactInHotel(hotelId: string, contactId: string): Promise<{ id: string } | null> {
    return this.prisma.hotelContact.findFirst({
      where: { id: contactId, hotelId, deletedAt: null },
      select: { id: true },
    });
  }

  async softDeleteContact(id: string, actorId: string): Promise<void> {
    await this.prisma.hotelContact.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }
}
