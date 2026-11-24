import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import {
  HOTEL_IMPORT_MAX_BYTES,
  hotelImportApplyBody,
  hotelImportApplyParams,
  hotelImportQuery,
  type HotelImportApplyBody,
  type HotelImportApplyParams,
  type HotelImportKind,
  type HotelImportQuery,
  type HotelImportResult,
} from "@ampm/core";
import type { Request } from "express";

import { readBoundedBody, type BoundedBodyOptions } from "../../common/bounded-body.js";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { UPLOADS } from "../../common/rate-limit/route-limits.js";
import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelImportService } from "./hotel-import.service.js";

/** The file: raw CSV bytes, as a file upload sends them or as text/csv, at most 5 MiB. */
const IMPORT_BODY: BoundedBodyOptions = {
  limitBytes: HOTEL_IMPORT_MAX_BYTES,
  contentTypes: ["application/octet-stream", "text/csv"],
};

/**
 * The staff spreadsheet import (TW-25; AC-35.1; D-181, D-183, D-184): one CSV template per kind, each
 * with its own route and static key, so the guard holds each kind to its own create key. A preview
 * (`POST imports/<kind>`, no query: any is refused) takes the file as the raw request body, read only
 * inside the handler (common/bounded-body.ts; D-176): authentication, the upload rate limit, the
 * permission and the query have all been checked before a byte is read, and no parser buffers it first
 * (POST_GUARD_PATHS). It writes nothing but its job. An import (`POST imports/<kind>/:jobId/apply`) is a
 * JSON route with no body: it applies the caller's preview by its job id. Hotels ask the hotel profile
 * create key, rooms and venues the room categories and venues create key, rates the rate cards and rate
 * items create key; each row is then held to the uploader's own keys. The service audits every row it
 * writes in its own transaction, hence `@SelfAudited`; both steps count against the upload limit, which
 * fails closed.
 */
@Controller("hotels-admin")
export class HotelImportController {
  constructor(private readonly imports: HotelImportService) {}

  @Post("imports/hotels")
  @RequirePermission("hotels.hotel_profiles_client_fields.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  importHotels(
    @ZodQuery(hotelImportQuery) _query: HotelImportQuery,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.preview("hotels", req, principal);
  }

  @Post("imports/rooms")
  @RequirePermission("hotels.room_categories_venues.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  importRooms(
    @ZodQuery(hotelImportQuery) _query: HotelImportQuery,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.preview("rooms", req, principal);
  }

  @Post("imports/venues")
  @RequirePermission("hotels.room_categories_venues.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  importVenues(
    @ZodQuery(hotelImportQuery) _query: HotelImportQuery,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.preview("venues", req, principal);
  }

  @Post("imports/rates")
  @RequirePermission("hotels.rate_cards_rate_items.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  importRates(
    @ZodQuery(hotelImportQuery) _query: HotelImportQuery,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.preview("rates", req, principal);
  }

  @Post("imports/hotels/:jobId/apply")
  @RequirePermission("hotels.hotel_profiles_client_fields.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  applyHotels(
    @ZodParams(hotelImportApplyParams) params: HotelImportApplyParams,
    @ZodBody(hotelImportApplyBody) _body: HotelImportApplyBody,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.imports.apply("hotels", params.jobId, principal);
  }

  @Post("imports/rooms/:jobId/apply")
  @RequirePermission("hotels.room_categories_venues.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  applyRooms(
    @ZodParams(hotelImportApplyParams) params: HotelImportApplyParams,
    @ZodBody(hotelImportApplyBody) _body: HotelImportApplyBody,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.imports.apply("rooms", params.jobId, principal);
  }

  @Post("imports/venues/:jobId/apply")
  @RequirePermission("hotels.room_categories_venues.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  applyVenues(
    @ZodParams(hotelImportApplyParams) params: HotelImportApplyParams,
    @ZodBody(hotelImportApplyBody) _body: HotelImportApplyBody,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.imports.apply("venues", params.jobId, principal);
  }

  @Post("imports/rates/:jobId/apply")
  @RequirePermission("hotels.rate_cards_rate_items.create")
  @RateLimit(UPLOADS)
  @HttpCode(200)
  @SelfAudited()
  applyRates(
    @ZodParams(hotelImportApplyParams) params: HotelImportApplyParams,
    @ZodBody(hotelImportApplyBody) _body: HotelImportApplyBody,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelImportResult> {
    return this.imports.apply("rates", params.jobId, principal);
  }

  /** Reads the file after the guards, within its limits, and previews it. */
  private async preview(
    kind: HotelImportKind,
    req: Request,
    principal: Principal,
  ): Promise<HotelImportResult> {
    const bytes = await readBoundedBody(req, IMPORT_BODY);
    return this.imports.preview(kind, bytes, principal);
  }
}
