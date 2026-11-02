import { Controller, Delete, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  destinationCreateRequest,
  hotelCreateRequest,
  hotelImportRequest,
  hotelStaffListQuery,
  hotelUpdateRequest,
  uuid,
  type DestinationCreateRequest,
  type DestinationView,
  type HotelCreateRequest,
  type HotelImportRequest,
  type HotelImportResult,
  type HotelStaffDetailView,
  type HotelStaffListQuery,
  type HotelStaffPage,
  type HotelUpdateRequest,
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
import { HotelsAdminService } from "./hotels-admin.service.js";

const hotelParam = z.object({ hotelId: uuid });
type HotelParam = z.infer<typeof hotelParam>;

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
}
