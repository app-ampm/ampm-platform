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

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { CLIENT_READS, CLIENT_WRITES } from "../../common/rate-limit/route-limits.js";
import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import { AuditExempt, CurrentPrincipal } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiriesClientService } from "./enquiries-client.service.js";

const enquiryParam = z.object({ enquiryId: uuid });
const HOUR = 60 * 60 * 1000;

/**
 * The client/demo side of hotel consultancy (CP-07/08): authenticated but not permission-keyed — the
 * service gates on the `hotel_assistance` entitlement and answers 404 to everyone else (the
 * HotelsController pattern). The client mutations are not §9 internal-user actions, so they are
 * audit-exempt with a reason (the enquiry row / the Sales lead activity is the record). An assistance
 * request is the costly route (a demo prospect's notifies Sales every time), so it has its own hourly
 * limit and fails closed (D-149).
 */
@Controller("consultancy")
@RateLimit(CLIENT_READS)
export class EnquiriesClientController {
  constructor(private readonly enquiries: EnquiriesClientService) {}

  @Post("enquiries")
  @HttpCode(201)
  @RateLimit({
    name: "consultancy.assistance_request",
    limit: 20,
    perIpLimit: 60,
    windowMs: HOUR,
    failClosed: true,
  })
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
  @RateLimit(CLIENT_WRITES)
  @AuditExempt("client edits their own enquiry note; not a §9 internal-user action")
  update(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodBody(hotelEnquiryClientUpdateRequest) body: HotelEnquiryClientUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelEnquiryClientView> {
    return this.enquiries.updateOwnNote(principal, params.enquiryId, body);
  }

  @Post("enquiries/:enquiryId/withdraw")
  @HttpCode(200)
  @RateLimit(CLIENT_WRITES)
  @AuditExempt(
    "client withdraws their own enquiry; the enquiry row and its timeline event are the record, not a §9 internal-user action",
  )
  withdraw(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelEnquiryClientView> {
    return this.enquiries.withdrawOwn(principal, params.enquiryId);
  }
}
