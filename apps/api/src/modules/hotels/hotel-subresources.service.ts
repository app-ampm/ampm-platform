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

import { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { requireContactsRead, requireContactsUpdate } from "./hotel-audience.js";
import {
  roomCreateData,
  roomPatchData,
  venueCreateData,
  venuePatchData,
  type StoredRoomArea,
  type StoredVenueAreas,
} from "./hotel-child-write.js";
import { contactPhone } from "./hotel-contact-phone.js";
import { HotelSubresourcesRepository, type ContactRow } from "./hotel-subresources.repository.js";
import { toHotelContactView, toRoomCategoryView, toVenueView } from "./hotels-admin.view.js";

/** Which hotel and contact a write names (null for a new one), and whether it makes it the primary. */
interface ContactWrite {
  readonly hotelId: string;
  readonly contactId: string | null;
  readonly makesPrimary: boolean;
}

/** Why a contact write lost the race for the hotel's one primary (the partial unique index refused it). */
const PRIMARY_RACE = "Another contact was made primary at the same time; try again";

/**
 * A hotel's room categories, venues and contacts (HT/SA; feature 9.1). Every write confirms the hotel
 * exists, and every update/delete confirms the child belongs to that hotel (a mismatch is a 404 — denial
 * equals absence). Rooms and venues are written as hotel-child-write.ts maps them (the units rule; a
 * venue's setting decides `is_indoor`, D-178), and a room or venue create is audited by the `@Audited`
 * interceptor on the route. A contact's phone is stored in E.164 (a repeated stored phone kept as it is),
 * and a hotel has one live primary contact: a write that names a new one demotes the current one in the
 * same transaction, audited, which needs the contacts update key. Contact writes, and room and venue
 * updates, record their audit in the write's own transaction; deletes record theirs here too.
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
    return toRoomCategoryView(
      await this.repo.createRoom(hotelId, roomCreateData(request), actorId),
    );
  }

  async updateRoom(
    hotelId: string,
    roomId: string,
    patch: RoomCategoryUpdateRequest,
    actorId: string,
  ): Promise<RoomCategoryView> {
    const stored = await this.requireRoom(hotelId, roomId);
    const row = await this.repo.transaction(async (tx) => {
      const updated = await this.repo.updateRoom(roomId, roomPatchData(patch, stored), actorId, tx);
      await this.record("update", "hotel_room_category", roomId, { name: updated.name }, tx);
      return updated;
    });
    return toRoomCategoryView(row);
  }

  async removeRoom(hotelId: string, roomId: string, actorId: string): Promise<{ id: string }> {
    await this.requireRoom(hotelId, roomId);
    await this.repo.softDeleteRoom(roomId, actorId);
    await this.record("delete", "hotel_room_category", roomId, { deleted: true });
    return { id: roomId };
  }

  async addVenue(
    hotelId: string,
    request: VenueCreateRequest,
    actorId: string,
  ): Promise<VenueView> {
    await this.requireHotel(hotelId);
    return toVenueView(await this.repo.createVenue(hotelId, venueCreateData(request), actorId));
  }

  async updateVenue(
    hotelId: string,
    venueId: string,
    patch: VenueUpdateRequest,
    actorId: string,
  ): Promise<VenueView> {
    const stored = await this.requireVenue(hotelId, venueId);
    const row = await this.repo.transaction(async (tx) => {
      const updated = await this.repo.updateVenue(
        venueId,
        venuePatchData(patch, stored),
        actorId,
        tx,
      );
      await this.record("update", "hotel_venue", venueId, { name: updated.name }, tx);
      return updated;
    });
    return toVenueView(row);
  }

  async removeVenue(hotelId: string, venueId: string, actorId: string): Promise<{ id: string }> {
    await this.requireVenue(hotelId, venueId);
    await this.repo.softDeleteVenue(venueId, actorId);
    await this.record("delete", "hotel_venue", venueId, { deleted: true });
    return { id: venueId };
  }

  /** A new contact, audited here (the route is `@SelfAudited`) with any primary it demotes. */
  async addContact(
    hotelId: string,
    request: HotelContactCreateRequest,
    principal: Principal,
  ): Promise<HotelContactView> {
    await this.requireHotel(hotelId);
    const data = { ...request, phone: contactPhone(request.phone, null) };
    const actorId = staffId(principal);
    const target = { hotelId, contactId: null, makesPrimary: data.isPrimary };
    return this.writeContact(principal, target, async (tx) => {
      const row = await this.repo.createContact(hotelId, data, actorId, tx);
      const after = { name: row.name, isPrimary: row.isPrimary };
      await this.record("create", "hotel_contact", row.id, after, tx);
      return row;
    });
  }

  /** The edit answers with the whole contact, so it needs the contacts read too (D-171). */
  async updateContact(
    hotelId: string,
    contactId: string,
    patch: HotelContactUpdateRequest,
    principal: Principal,
  ): Promise<HotelContactView> {
    requireContactsRead(principal);
    const stored = await this.requireContact(hotelId, contactId);
    const data = { ...patch, phone: contactPhone(patch.phone, stored.phone) };
    const actorId = staffId(principal);
    const makesPrimary = data.isPrimary === true;
    return this.writeContact(principal, { hotelId, contactId, makesPrimary }, async (tx) => {
      const row = await this.repo.updateContact(contactId, data, actorId, tx);
      await this.record("update", "hotel_contact", contactId, { name: row.name }, tx);
      return row;
    });
  }

  async removeContact(
    hotelId: string,
    contactId: string,
    actorId: string,
  ): Promise<{ id: string }> {
    await this.requireContact(hotelId, contactId);
    await this.repo.softDeleteContact(contactId, actorId);
    await this.record("delete", "hotel_contact", contactId, { deleted: true });
    return { id: contactId };
  }

  /**
   * Runs one contact write in a transaction, first demoting the hotel's current live primary when the
   * write names a new one. A write that loses the race for the one primary (the partial unique index)
   * answers 409.
   */
  private async writeContact(
    principal: Principal,
    target: ContactWrite,
    write: (tx: Prisma.TransactionClient) => Promise<ContactRow>,
  ): Promise<HotelContactView> {
    try {
      const row = await this.repo.transaction(async (tx) => {
        if (target.makesPrimary) await this.demotePrimary(principal, target, tx);
        return write(tx);
      });
      return toHotelContactView(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict(PRIMARY_RACE);
      }
      throw error;
    }
  }

  /** Demotes the hotel's live primary (not the contact being written), each with its own audit event. */
  private async demotePrimary(
    principal: Principal,
    target: { readonly hotelId: string; readonly contactId: string | null },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const primaries = await this.repo.findLivePrimaries(target.hotelId, target.contactId, tx);
    if (primaries.length === 0) return;
    requireContactsUpdate(principal);
    await this.repo.demoteContacts(
      primaries.map(({ id }) => id),
      staffId(principal),
      tx,
    );
    for (const { id } of primaries) {
      const after = { isPrimary: false, changedFields: ["isPrimary"] };
      await this.audit.record(
        {
          action: "update",
          entityType: "hotel_contact",
          entityId: id,
          before: { isPrimary: true },
          after,
          maskImages: false,
        },
        tx,
      );
    }
  }

  private record(
    action: "create" | "update" | "delete",
    entityType: string,
    entityId: string,
    after: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.audit.record(
      { action, entityType, entityId, before: null, after, maskImages: false },
      tx,
    );
  }

  private async requireHotel(hotelId: string): Promise<void> {
    if (!(await this.repo.hotelExists(hotelId))) throw errors.notFound("No such hotel");
  }

  private async requireRoom(hotelId: string, roomId: string): Promise<StoredRoomArea> {
    const room = await this.repo.findRoomInHotel(hotelId, roomId);
    if (!room) throw errors.notFound("No such room category");
    return room;
  }

  private async requireVenue(hotelId: string, venueId: string): Promise<StoredVenueAreas> {
    const venue = await this.repo.findVenueInHotel(hotelId, venueId);
    if (!venue) throw errors.notFound("No such venue");
    return venue;
  }

  private async requireContact(
    hotelId: string,
    contactId: string,
  ): Promise<{ readonly phone: string | null }> {
    const contact = await this.repo.findContactInHotel(hotelId, contactId);
    if (!contact) throw errors.notFound("No such hotel contact");
    return contact;
  }
}
