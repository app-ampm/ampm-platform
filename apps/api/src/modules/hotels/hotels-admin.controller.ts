import { Controller, Delete, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  destinationCreateRequest,
  destinationUpdateRequest,
  hotelContactCreateRequest,
  hotelContactUpdateRequest,
  hotelCreateRequest,
  hotelImportRequest,
  hotelStaffListQuery,
  hotelUpdateRequest,
  roomCategoryCreateRequest,
  roomCategoryUpdateRequest,
  uuid,
  venueCreateRequest,
  venueUpdateRequest,
  type DestinationCreateRequest,
  type DestinationUpdateRequest,
  type DestinationView,
  type HotelContactCreateRequest,
  type HotelContactUpdateRequest,
  type HotelContactView,
  type HotelCreateRequest,
  type HotelImportRequest,
  type HotelImportResult,
  type HotelStaffDetailView,
  type HotelStaffListQuery,
  type HotelStaffPage,
  type HotelUpdateRequest,
  type RoomCategoryCreateRequest,
  type RoomCategoryUpdateRequest,
  type RoomCategoryView,
  type VenueCreateRequest,
  type VenueUpdateRequest,
  type VenueView,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import {
  AuditExempt,
  Audited,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelImportService } from "./hotel-import.service.js";
import { HotelSubresourcesService } from "./hotel-subresources.service.js";
import { HotelsAdminService } from "./hotels-admin.service.js";

const hotelParam = z.object({ hotelId: uuid });
type HotelParam = z.infer<typeof hotelParam>;
const roomParam = z.object({ hotelId: uuid, roomId: uuid });
type RoomParam = z.infer<typeof roomParam>;
const venueParam = z.object({ hotelId: uuid, venueId: uuid });
type VenueParam = z.infer<typeof venueParam>;
const contactParam = z.object({ hotelId: uuid, contactId: uuid });
type ContactParam = z.infer<typeof contactParam>;
const destinationParam = z.object({ destinationId: uuid });
type DestinationParam = z.infer<typeof destinationParam>;

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * The staff hotel catalogue (HT/SA; feature 9.1). A separate prefix from the client discovery controller
 * at `hotels` — its distinct first segment avoids any `/hotels/:id` route-ordering ambiguity — and every
 * route is `@RequirePermission("hotels.*")`, the 8-step guard, not the entitlement path. The import
 * records its own per-row audit, so its route is `@AuditExempt`.
 */
@Controller("hotels-admin")
export class HotelsAdminController {
  constructor(
    private readonly hotels: HotelsAdminService,
    private readonly imports: HotelImportService,
    private readonly subresources: HotelSubresourcesService,
  ) {}

  @Get("hotels")
  @RequirePermission("hotels.hotel_profiles_client_fields.read")
  list(@ZodQuery(hotelStaffListQuery) query: HotelStaffListQuery): Promise<HotelStaffPage> {
    return this.hotels.list(query);
  }

  @Get("hotels/:hotelId")
  @RequirePermission("hotels.hotel_profiles_client_fields.read")
  get(@ZodParams(hotelParam) params: HotelParam): Promise<HotelStaffDetailView> {
    return this.hotels.getDetail(params.hotelId);
  }

  @Post("hotels")
  @RequirePermission("hotels.hotel_profiles_client_fields.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel" })
  create(
    @ZodBody(hotelCreateRequest) body: HotelCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelStaffDetailView> {
    return this.hotels.create(body, staffId(principal));
  }

  @Patch("hotels/:hotelId")
  @RequirePermission("hotels.hotel_profiles_client_fields.update")
  @SelfAudited()
  update(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodBody(hotelUpdateRequest) body: HotelUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelStaffDetailView> {
    return this.hotels.update(params.hotelId, body, staffId(principal));
  }

  @Delete("hotels/:hotelId")
  @RequirePermission("hotels.hotel_profiles_client_fields.delete")
  @SelfAudited()
  remove(
    @ZodParams(hotelParam) params: HotelParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ id: string }> {
    return this.hotels.remove(params.hotelId, staffId(principal));
  }

  @Get("destinations")
  @RequirePermission("hotels.destinations.read")
  listDestinations(): Promise<{ items: DestinationView[] }> {
    return this.hotels.listDestinations();
  }

  @Post("destinations")
  @RequirePermission("hotels.destinations.create")
  @HttpCode(201)
  @Audited({ entityType: "destination" })
  createDestination(
    @ZodBody(destinationCreateRequest) body: DestinationCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<DestinationView> {
    return this.hotels.createDestination(body, staffId(principal));
  }

  @Patch("destinations/:destinationId")
  @RequirePermission("hotels.destinations.update")
  @SelfAudited()
  updateDestination(
    @ZodParams(destinationParam) params: DestinationParam,
    @ZodBody(destinationUpdateRequest) body: DestinationUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<DestinationView> {
    return this.hotels.updateDestination(params.destinationId, body, staffId(principal));
  }

  @Post("imports")
  @RequirePermission("hotels.hotel_profiles_client_fields.create")
  @HttpCode(200)
  @AuditExempt(
    "the import records a per-row audit event and an import_jobs row in the service (AC-35.1)",
  )
  importHotels(
    @ZodBody(hotelImportRequest) body: HotelImportRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.imports.import(body, staffId(principal));
  }

  // --- Room categories, venues and contacts of a hotel (feature 9.1). ---

  @Post("hotels/:hotelId/rooms")
  @RequirePermission("hotels.room_categories_venues.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel_room_category" })
  addRoom(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodBody(roomCategoryCreateRequest) body: RoomCategoryCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RoomCategoryView> {
    return this.subresources.addRoom(params.hotelId, body, staffId(principal));
  }

  @Patch("hotels/:hotelId/rooms/:roomId")
  @RequirePermission("hotels.room_categories_venues.update")
  @SelfAudited()
  updateRoom(
    @ZodParams(roomParam) params: RoomParam,
    @ZodBody(roomCategoryUpdateRequest) body: RoomCategoryUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RoomCategoryView> {
    return this.subresources.updateRoom(params.hotelId, params.roomId, body, staffId(principal));
  }

  @Delete("hotels/:hotelId/rooms/:roomId")
  @RequirePermission("hotels.room_categories_venues.delete")
  @SelfAudited()
  removeRoom(
    @ZodParams(roomParam) params: RoomParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ id: string }> {
    return this.subresources.removeRoom(params.hotelId, params.roomId, staffId(principal));
  }

  @Post("hotels/:hotelId/venues")
  @RequirePermission("hotels.room_categories_venues.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel_venue" })
  addVenue(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodBody(venueCreateRequest) body: VenueCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<VenueView> {
    return this.subresources.addVenue(params.hotelId, body, staffId(principal));
  }

  @Patch("hotels/:hotelId/venues/:venueId")
  @RequirePermission("hotels.room_categories_venues.update")
  @SelfAudited()
  updateVenue(
    @ZodParams(venueParam) params: VenueParam,
    @ZodBody(venueUpdateRequest) body: VenueUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<VenueView> {
    return this.subresources.updateVenue(params.hotelId, params.venueId, body, staffId(principal));
  }

  @Delete("hotels/:hotelId/venues/:venueId")
  @RequirePermission("hotels.room_categories_venues.delete")
  @SelfAudited()
  removeVenue(
    @ZodParams(venueParam) params: VenueParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ id: string }> {
    return this.subresources.removeVenue(params.hotelId, params.venueId, staffId(principal));
  }

  @Post("hotels/:hotelId/contacts")
  @RequirePermission("hotels.hotel_contacts.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel_contact" })
  addContact(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodBody(hotelContactCreateRequest) body: HotelContactCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelContactView> {
    return this.subresources.addContact(params.hotelId, body, staffId(principal));
  }

  @Patch("hotels/:hotelId/contacts/:contactId")
  @RequirePermission("hotels.hotel_contacts.update")
  @SelfAudited()
  updateContact(
    @ZodParams(contactParam) params: ContactParam,
    @ZodBody(hotelContactUpdateRequest) body: HotelContactUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelContactView> {
    return this.subresources.updateContact(
      params.hotelId,
      params.contactId,
      body,
      staffId(principal),
    );
  }

  @Delete("hotels/:hotelId/contacts/:contactId")
  @RequirePermission("hotels.hotel_contacts.delete")
  @SelfAudited()
  removeContact(
    @ZodParams(contactParam) params: ContactParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ id: string }> {
    return this.subresources.removeContact(params.hotelId, params.contactId, staffId(principal));
  }
}
