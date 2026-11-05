import { Controller, Get, Patch } from "@nestjs/common";
import {
  siteVisitFeedbackRequest,
  siteVisitListQuery,
  uuid,
  type SiteVisitClientPage,
  type SiteVisitClientView,
  type SiteVisitFeedbackRequest,
  type SiteVisitListQuery,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import { AuditExempt, CurrentPrincipal } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { SiteVisitsClientService } from "./site-visits-client.service.js";

const enquiryParam = z.object({ enquiryId: uuid });

/**
 * The client/demo side of site visits (CP, AC-05.5): authenticated but not permission-keyed — the
 * service gates on the `hotel_assistance` entitlement and scopes to the caller's own account through
 * the enquiry, answering 404 to everyone else (the enquiries-client pattern). The feedback write is a
 * client action, not a §9 internal-user action, so it is audit-exempt with a reason (the visit is the record).
 */
@Controller("consultancy")
export class SiteVisitsClientController {
  constructor(private readonly visits: SiteVisitsClientService) {}

  @Get("enquiries/:enquiryId/visits")
  list(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodQuery(siteVisitListQuery) query: SiteVisitListQuery,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SiteVisitClientPage> {
    return this.visits.listForEnquiry(principal, params.enquiryId, query);
  }

  @Patch("visits/:visitId/feedback")
  @AuditExempt(
    "client submits their own site-visit feedback; the visit row is the record, not a §9 internal-user action",
  )
  feedback(
    @ZodParams(z.object({ visitId: uuid })) params: { visitId: string },
    @ZodBody(siteVisitFeedbackRequest) body: SiteVisitFeedbackRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SiteVisitClientView> {
    return this.visits.updateFeedback(principal, params.visitId, body);
  }
}
