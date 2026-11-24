import { Controller, Get, Header, HttpCode, Patch, Post } from "@nestjs/common";
import {
  hotelDuplicateHintsQuery,
  hotelInfoRequestCreateRequest,
  hotelInfoRequestHistoryQuery,
  hotelInfoRequestListQuery,
  hotelInfoRequestReissueRequest,
  hotelInfoRequestRevokeRequest,
  hotelInfoRequestShareRecordRequest,
  hotelInfoRequestUpdateRequest,
  uuid,
  type HotelDuplicateHints,
  type HotelDuplicateHintsQuery,
  type HotelInfoRequestCreateRequest,
  type HotelInfoRequestDetail,
  type HotelInfoRequestHistoryQuery,
  type HotelInfoRequestLinkIssued,
  type HotelInfoRequestListQuery,
  type HotelInfoRequestPage,
  type HotelInfoRequestReissueRequest,
  type HotelInfoRequestRevokeRequest,
  type HotelInfoRequestShareRecordRequest,
  type HotelInfoRequestUpdateRequest,
} from "@ampm/core";
import { z } from "zod";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { HOTEL_FORM_LINKS } from "../../common/rate-limit/route-limits.js";
import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelInfoRequestIssueService } from "./hotel-info-request-issue.service.js";
import { HotelInfoRequestsService } from "./hotel-info-requests.service.js";

const requestParam = z.object({ id: uuid }).strict();
type RequestParam = z.infer<typeof requestParam>;
const hotelParam = z.object({ hotelId: uuid }).strict();
type HotelParam = z.infer<typeof hotelParam>;

/** Keeps an answer that carries a link out of every cache: it is shown once. */
const NO_STORE = ["Cache-Control", "no-store"] as const;

/**
 * Hotel information requests, the staff side (D-188 §3; plan §7.2), under the `hotels-admin` prefix and
 * keyed `hotels.info_requests.*` (permission-matrix §5.3: SA and HT create, read and update, SM and PM
 * read; anyone else is answered 404). The duplicate hints' path avoids `hotels/:hotelId`, which would
 * otherwise capture it. Every change is audited in its service's transaction, and issuing, reissuing and
 * recording a share with the action `share`; the link is answered only by create and reissue, which a
 * member of staff calls at most 30 times in ten minutes, and is never in an audit image, a log or an
 * event.
 */
@Controller("hotels-admin")
export class HotelInfoRequestsController {
  constructor(
    private readonly requests: HotelInfoRequestsService,
    private readonly issue: HotelInfoRequestIssueService,
  ) {}

  @Get("hotel-duplicate-hints")
  @RequirePermission("hotels.info_requests.create")
  duplicateHints(
    @ZodQuery(hotelDuplicateHintsQuery) query: HotelDuplicateHintsQuery,
  ): Promise<HotelDuplicateHints> {
    return this.requests.duplicateHints(query);
  }

  @Post("info-requests")
  @RequirePermission("hotels.info_requests.create")
  @RateLimit(HOTEL_FORM_LINKS)
  @HttpCode(201)
  @Header(...NO_STORE)
  @SelfAudited()
  create(
    @ZodBody(hotelInfoRequestCreateRequest) body: HotelInfoRequestCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelInfoRequestLinkIssued> {
    return this.issue.create(body, principal);
  }

  @Get("info-requests")
  @RequirePermission("hotels.info_requests.read")
  list(
    @ZodQuery(hotelInfoRequestListQuery) query: HotelInfoRequestListQuery,
  ): Promise<HotelInfoRequestPage> {
    return this.requests.list(query);
  }

  @Get("info-requests/:id")
  @RequirePermission("hotels.info_requests.read")
  get(
    @ZodParams(requestParam) params: RequestParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelInfoRequestDetail> {
    return this.requests.get(params.id, principal);
  }

  @Patch("info-requests/:id")
  @RequirePermission("hotels.info_requests.update")
  @SelfAudited()
  update(
    @ZodParams(requestParam) params: RequestParam,
    @ZodBody(hotelInfoRequestUpdateRequest) body: HotelInfoRequestUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelInfoRequestDetail> {
    return this.requests.update(params.id, body, principal);
  }

  @Post("info-requests/:id/reissue")
  @RequirePermission("hotels.info_requests.update")
  @RateLimit(HOTEL_FORM_LINKS)
  @HttpCode(200)
  @Header(...NO_STORE)
  @SelfAudited()
  reissue(
    @ZodParams(requestParam) params: RequestParam,
    @ZodBody(hotelInfoRequestReissueRequest) body: HotelInfoRequestReissueRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelInfoRequestLinkIssued> {
    return this.issue.reissue(params.id, body, principal);
  }

  @Post("info-requests/:id/share-record")
  @RequirePermission("hotels.info_requests.update")
  @HttpCode(200)
  @SelfAudited()
  recordShare(
    @ZodParams(requestParam) params: RequestParam,
    @ZodBody(hotelInfoRequestShareRecordRequest) body: HotelInfoRequestShareRecordRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelInfoRequestDetail> {
    return this.requests.recordShare(params.id, body, principal);
  }

  @Post("info-requests/:id/revoke")
  @RequirePermission("hotels.info_requests.update")
  @HttpCode(200)
  @SelfAudited()
  revoke(
    @ZodParams(requestParam) params: RequestParam,
    @ZodBody(hotelInfoRequestRevokeRequest) body: HotelInfoRequestRevokeRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelInfoRequestDetail> {
    return this.requests.revoke(params.id, body, principal);
  }

  @Get("hotels/:hotelId/info-requests")
  @RequirePermission("hotels.info_requests.read")
  history(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodQuery(hotelInfoRequestHistoryQuery) query: HotelInfoRequestHistoryQuery,
  ): Promise<HotelInfoRequestPage> {
    return this.requests.history(params.hotelId, query);
  }
}
