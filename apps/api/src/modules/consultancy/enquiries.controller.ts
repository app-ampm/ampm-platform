import { Controller, Get, Patch, Post } from "@nestjs/common";
import {
  hotelEnquiryEventCreateRequest,
  hotelEnquiryListQuery,
  hotelEnquiryStaffUpdateRequest,
  hotelEnquiryStatusUpdateRequest,
  uuid,
  type HotelEnquiryClientDetailView,
  type HotelEnquiryEventCreateRequest,
  type HotelEnquiryEventView,
  type HotelEnquiryListQuery,
  type HotelEnquiryStaffDetailView,
  type HotelEnquiryStaffPage,
  type HotelEnquiryStaffUpdateRequest,
  type HotelEnquiryStaffView,
  type HotelEnquiryStatusUpdateRequest,
} from "@ampm/core";
import { z } from "zod";

import type { Access } from "../../common/request-context.js";
import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import {
  CurrentAccess,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiriesService } from "./enquiries.service.js";

const enquiryParam = z.object({ enquiryId: uuid });

/**
 * The Hotel-team enquiry workspace (TW-26, API-first). Every route is keyed on `consultancy.enquiries.*`
 * and scoped through `@CurrentAccess`; the status/update/event writes self-audit inside their service
 * transaction. The polished screen follows design approvals (build-plan 20–24).
 */
@Controller("consultancy-admin")
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Get("enquiries")
  @RequirePermission("consultancy.enquiries.read")
  list(
    @ZodQuery(hotelEnquiryListQuery) query: HotelEnquiryListQuery,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelEnquiryStaffPage> {
    return this.enquiries.list(principal, access, query);
  }

  @Get("enquiries/:enquiryId")
  @RequirePermission("consultancy.enquiries.read")
  get(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelEnquiryStaffDetailView> {
    return this.enquiries.get(principal, access, params.enquiryId);
  }

  @Get("enquiries/:enquiryId/preview")
  @RequirePermission("consultancy.enquiries.read")
  preview(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelEnquiryClientDetailView> {
    return this.enquiries.previewAsClient(principal, access, params.enquiryId);
  }

  @Patch("enquiries/:enquiryId/status")
  @RequirePermission("consultancy.enquiries.update")
  @SelfAudited()
  transition(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodBody(hotelEnquiryStatusUpdateRequest) body: HotelEnquiryStatusUpdateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelEnquiryStaffView> {
    return this.enquiries.transition(principal, access, params.enquiryId, body);
  }

  @Patch("enquiries/:enquiryId")
  @RequirePermission("consultancy.enquiries.update")
  @SelfAudited()
  update(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodBody(hotelEnquiryStaffUpdateRequest) body: HotelEnquiryStaffUpdateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelEnquiryStaffView> {
    return this.enquiries.updateStaffFields(principal, access, params.enquiryId, body);
  }

  @Post("enquiries/:enquiryId/events")
  @RequirePermission("consultancy.enquiries.update")
  @SelfAudited()
  addEvent(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodBody(hotelEnquiryEventCreateRequest) body: HotelEnquiryEventCreateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelEnquiryEventView> {
    return this.enquiries.addEvent(principal, access, params.enquiryId, body);
  }
}
