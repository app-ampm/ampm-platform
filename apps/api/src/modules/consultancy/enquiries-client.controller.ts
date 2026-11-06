import { Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  hotelEnquiryClientUpdateRequest,
  hotelEnquiryCreateRequest,
  hotelEnquiryListQuery,
  uuid,
  type HotelAssistanceRequestResponse,
  type HotelEnquiryClientDetailView,
  type HotelEnquiryClientPage,
  type HotelEnquiryClientUpdateRequest,
  type HotelEnquiryClientView,
  type HotelEnquiryCreateRequest,
  type HotelEnquiryListQuery,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import { AuditExempt, CurrentPrincipal } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiriesClientService } from "./enquiries-client.service.js";

const enquiryParam = z.object({ enquiryId: uuid });

/**
 * The client/demo side of hotel consultancy (CP-07/08): authenticated but not permission-keyed — the
 * service gates on the `hotel_assistance` entitlement and answers 404 to everyone else (the
 * HotelsController pattern). The client mutations are not §9 internal-user actions, so they are
 * audit-exempt with a reason (the enquiry row / the Sales lead activity is the record).
 */
@Controller("consultancy")
export class EnquiriesClientController {
  constructor(private readonly enquiries: EnquiriesClientService) {}

  @Post("enquiries")
  @HttpCode(201)
  @AuditExempt(
    "client/demo hotel-assistance request; the enquiry row (or the Sales lead activity, P-7) is the record, not a §9 internal-user action",
  )
  request(
    @ZodBody(hotelEnquiryCreateRequest) body: HotelEnquiryCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelAssistanceRequestResponse> {
    return this.enquiries.requestAssistance(principal, body);
  }

  @Get("enquiries")
  list(
    @ZodQuery(hotelEnquiryListQuery) query: HotelEnquiryListQuery,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelEnquiryClientPage> {
    return this.enquiries.listOwn(principal, query);
  }

  @Get("enquiries/:enquiryId")
  get(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelEnquiryClientDetailView> {
    return this.enquiries.getOwn(principal, params.enquiryId);
  }

  @Patch("enquiries/:enquiryId")
  @AuditExempt("client edits their own enquiry note; not a §9 internal-user action")
  update(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodBody(hotelEnquiryClientUpdateRequest) body: HotelEnquiryClientUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelEnquiryClientView> {
    return this.enquiries.updateOwnNote(principal, params.enquiryId, body);
  }
}
