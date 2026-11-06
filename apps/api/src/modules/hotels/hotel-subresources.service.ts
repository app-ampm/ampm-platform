import { Injectable } from "@nestjs/common";
import {
  errors,
  type HotelContactCreateRequest,
  type HotelContactUpdateRequest,
  type HotelContactView,
  type RoomCategoryCreateRequest,
  type RoomCategoryUpdateRequest,
  type RoomCategoryView,
  type VenueCreateRequest,
  type VenueUpdateRequest,
  type VenueView,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { HotelSubresourcesRepository } from "./hotel-subresources.repository.js";
import { toHotelContactView, toRoomCategoryView, toVenueView } from "./hotels-admin.view.js";

/**
 * A hotel's room categories, venues and contacts (HT/SA; feature 9.1). Every write confirms the hotel
 * exists, and every update/delete confirms the child belongs to that hotel (a mismatch is a 404 —
 * denial equals absence). Create is audited by the `@Audited` interceptor on the route; update and
 * delete record their own audit here.
 */
@Injectable()
export class HotelSubresourcesService {
  constructor(
    private readonly repo: HotelSubresourcesRepository,
    private readonly audit: AuditService,
  ) {}

  async addRoom(
    hotelId: string,
    request: RoomCategoryCreateRequest,
    actorId: string,
  ): Promise<RoomCategoryView> {
    await this.requireHotel(hotelId);
    return toRoomCategoryView(await this.repo.createRoom(hotelId, request, actorId));
  }

  async updateRoom(
    hotelId: string,
    roomId: string,
    patch: RoomCategoryUpdateRequest,
    actorId: string,
  ): Promise<RoomCategoryView> {
    await this.requireRoom(hotelId, roomId);
    const row = await this.repo.updateRoom(roomId, patch, actorId);
    await this.auditMutation("update", "hotel_room_category", roomId, { name: row.name });
    return toRoomCategoryView(row);
  }

  async removeRoom(hotelId: string, roomId: string, actorId: string): Promise<{ id: string }> {
    await this.requireRoom(hotelId, roomId);
    await this.repo.softDeleteRoom(roomId, actorId);
    await this.auditMutation("delete", "hotel_room_category", roomId, { deleted: true });
    return { id: roomId };
  }

  async addVenue(
    hotelId: string,
    request: VenueCreateRequest,
    actorId: string,
  ): Promise<VenueView> {
    await this.requireHotel(hotelId);
    return toVenueView(await this.repo.createVenue(hotelId, request, actorId));
  }

  async updateVenue(
    hotelId: string,
    venueId: string,
    patch: VenueUpdateRequest,
    actorId: string,
  ): Promise<VenueView> {
    await this.requireVenue(hotelId, venueId);
    const row = await this.repo.updateVenue(venueId, patch, actorId);
    await this.auditMutation("update", "hotel_venue", venueId, { name: row.name });
    return toVenueView(row);
  }

  async removeVenue(hotelId: string, venueId: string, actorId: string): Promise<{ id: string }> {
    await this.requireVenue(hotelId, venueId);
    await this.repo.softDeleteVenue(venueId, actorId);
    await this.auditMutation("delete", "hotel_venue", venueId, { deleted: true });
    return { id: venueId };
  }

  async addContact(
    hotelId: string,
    request: HotelContactCreateRequest,
    actorId: string,
  ): Promise<HotelContactView> {
    await this.requireHotel(hotelId);
    return toHotelContactView(await this.repo.createContact(hotelId, request, actorId));
  }

  async updateContact(
    hotelId: string,
    contactId: string,
    patch: HotelContactUpdateRequest,
    actorId: string,
  ): Promise<HotelContactView> {
    await this.requireContact(hotelId, contactId);
    const row = await this.repo.updateContact(contactId, patch, actorId);
    await this.auditMutation("update", "hotel_contact", contactId, { name: row.name });
    return toHotelContactView(row);
  }

  async removeContact(
    hotelId: string,
    contactId: string,
    actorId: string,
  ): Promise<{ id: string }> {
    await this.requireContact(hotelId, contactId);
    await this.repo.softDeleteContact(contactId, actorId);
    await this.auditMutation("delete", "hotel_contact", contactId, { deleted: true });
    return { id: contactId };
  }

  private auditMutation(
    action: "update" | "delete",
    entityType: string,
    entityId: string,
    after: unknown,
  ): Promise<void> {
    return this.audit.record({
      action,
      entityType,
      entityId,
      before: null,
      after,
      maskImages: false,
    });
  }

  private async requireHotel(hotelId: string): Promise<void> {
    if (!(await this.repo.hotelExists(hotelId))) throw errors.notFound("No such hotel");
  }

  private async requireRoom(hotelId: string, roomId: string): Promise<void> {
    if (!(await this.repo.findRoomInHotel(hotelId, roomId))) {
      throw errors.notFound("No such room category");
    }
  }

  private async requireVenue(hotelId: string, venueId: string): Promise<void> {
    if (!(await this.repo.findVenueInHotel(hotelId, venueId))) {
      throw errors.notFound("No such venue");
    }
  }

  private async requireContact(hotelId: string, contactId: string): Promise<void> {
    if (!(await this.repo.findContactInHotel(hotelId, contactId))) {
      throw errors.notFound("No such hotel contact");
    }
  }
}
