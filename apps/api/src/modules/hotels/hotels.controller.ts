import { Controller, Delete, Get, HttpCode, Post } from "@nestjs/common";
import {
  hotelListQuery,
  savedHotelListQuery,
  uuid,
  type DestinationBrowseResponse,
  type HotelDetailView,
  type HotelListQuery,
  type HotelPage,
  type SavedHotelListQuery,
  type SavedHotelPage,
  type SavedHotelRemovedResponse,
  type SavedHotelView,
} from "@ampm/core";
import { z } from "zod";

import { ZodParams, ZodQuery } from "../../common/zod.js";
import { AuditExempt, CurrentPrincipal } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelsService } from "./hotels.service.js";

const hotelParam = z.object({ hotelId: uuid });
type HotelParam = z.infer<typeof hotelParam>;

/**
 * Module C — client hotel discovery (CP-11). Authenticated but NOT @RequirePermission: clients and the
 * demo reach hotels through entitlements, not a staff permission key, so the service gates every call on
 * `principal.entitlements` and scopes reads by `hotelReach`. Not @Public — an anonymous caller has no
 * entitlements. Every denial is a 404 (security.md, denial equals absence).
 */
@Controller("hotels")
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Get()
  list(
    @ZodQuery(hotelListQuery) query: HotelListQuery,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelPage> {
    return this.hotels.list(principal, query);
  }

  // Declared before `:hotelId` so "saved" resolves to this route, not the hotel-detail param handler.
  @Get("saved")
  listSaved(
    @ZodQuery(savedHotelListQuery) query: SavedHotelListQuery,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SavedHotelPage> {
    return this.hotels.listSaved(principal, query);
  }

  // Declared before `:hotelId` so "destinations" resolves here, not to the hotel-detail param handler.
  @Get("destinations")
  browseDestinations(@CurrentPrincipal() principal: Principal): Promise<DestinationBrowseResponse> {
    return this.hotels.browseDestinations(principal);
  }

  @Get(":hotelId")
  get(
    @ZodParams(hotelParam) params: HotelParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelDetailView> {
    return this.hotels.get(principal, params.hotelId);
  }

  // A client save is low-stakes and the AuditInterceptor does not fire for a client principal, so
  // @AuditExempt with a reason satisfies the audit-coverage test (decorators.ts) for this mutation.
  @Post(":hotelId/save")
  @HttpCode(201)
  @AuditExempt(
    "a client saves a hotel to their own account shortlist; the saved_hotels row is a convenience list, not a §9 internal-user action",
  )
  save(
    @ZodParams(hotelParam) params: HotelParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SavedHotelView> {
    return this.hotels.save(principal, params.hotelId);
  }

  @Delete(":hotelId/save")
  @AuditExempt(
    "a client removes a hotel from their own account shortlist; a convenience list, not a §9 internal-user action",
  )
  unsave(
    @ZodParams(hotelParam) params: HotelParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SavedHotelRemovedResponse> {
    return this.hotels.unsave(principal, params.hotelId);
  }
}
