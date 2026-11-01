import { Controller, Get, HttpCode, Ip, Patch, Post } from "@nestjs/common";
import {
  leadActivityCreateRequest,
  leadAssignRequest,
  leadCreateRequest,
  leadEnquiryRequest,
  leadFunnelQuery,
  leadListQuery,
  leadMergeRequest,
  leadUpdateRequest,
  uuid,
  type LeadActivityCreateRequest,
  type LeadActivityList,
  type LeadActivityView,
  type LeadAssignRequest,
  type LeadCreateRequest,
  type LeadEnquiryRequest,
  type LeadEnquiryResponse,
  type LeadFunnelQuery,
  type LeadFunnelView,
  type LeadListQuery,
  type LeadMergeRequest,
  type LeadPage,
  type LeadUpdateRequest,
  type LeadView,
} from "@ampm/core";
import { z } from "zod";

import { RateLimit } from "../../../common/rate-limit/rate-limit.decorator.js";
import { ZodBody, ZodParams, ZodQuery } from "../../../common/zod.js";
import {
  AuditExempt,
  Audited,
  CurrentPrincipal,
  Public,
  RequirePermission,
  SelfAudited,
} from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { LeadEnquiryService } from "./lead-enquiry.service.js";
import { LeadsService } from "./leads.service.js";

const leadParam = z.object({ leadId: uuid });

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Lead capture (Module B CRM, feature 8.1). The enquiry endpoint is public (a prospect has no
 * account), rate-limited and bot-checked; everything else is the Sales workspace behind `crm.leads.*`
 * and the funnel behind the §5.16 report key (so HT, who may read leads, still cannot run it — AC-01.7).
 */
@Controller("crm")
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly enquiry: LeadEnquiryService,
  ) {}

  @Post("enquiries")
  @Public()
  @RateLimit({ name: "crm.enquiry", limit: 20, windowMs: 60_000 })
  @HttpCode(201)
  @AuditExempt(
    "public anonymous enquiry; the lead row and the Sales notification are the record, not a §9 internal-user action",
  )
  submit(
    @ZodBody(leadEnquiryRequest) body: LeadEnquiryRequest,
    @Ip() ip: string,
  ): Promise<LeadEnquiryResponse> {
    return this.enquiry.submit(body, ip);
  }

  @Get("leads")
  @RequirePermission("crm.leads.read")
  list(@ZodQuery(leadListQuery) query: LeadListQuery): Promise<LeadPage> {
    return this.leads.list(query);
  }

  @Get("reports/lead-funnel")
  @RequirePermission("reports.lead_source_conversion_funnel.read")
  funnel(@ZodQuery(leadFunnelQuery) query: LeadFunnelQuery): Promise<LeadFunnelView> {
    return this.leads.funnel(query);
  }

  @Get("leads/:leadId")
  @RequirePermission("crm.leads.read")
  get(@ZodParams(leadParam) params: { leadId: string }): Promise<LeadView> {
    return this.leads.get(params.leadId);
  }

  @Get("leads/:leadId/activities")
  @RequirePermission("crm.leads.read")
  activities(@ZodParams(leadParam) params: { leadId: string }): Promise<LeadActivityList> {
    return this.leads.getActivities(params.leadId);
  }

  @Post("leads")
  @RequirePermission("crm.leads.create")
  @Audited({ entityType: "lead" })
  create(
    @ZodBody(leadCreateRequest) body: LeadCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LeadView> {
    return this.leads.create(body, staffId(principal));
  }

  @Patch("leads/:leadId")
  @RequirePermission("crm.leads.update")
  @SelfAudited()
  update(
    @ZodParams(leadParam) params: { leadId: string },
    @ZodBody(leadUpdateRequest) body: LeadUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LeadView> {
    return this.leads.update(params.leadId, body, staffId(principal));
  }

  @Patch("leads/:leadId/owner")
  @RequirePermission("crm.leads.update")
  @SelfAudited()
  assign(
    @ZodParams(leadParam) params: { leadId: string },
    @ZodBody(leadAssignRequest) body: LeadAssignRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LeadView> {
    return this.leads.assign(params.leadId, body.ownerUserId, staffId(principal));
  }

  @Post("leads/:leadId/activities")
  @RequirePermission("crm.leads.update")
  @Audited({ entityType: "lead_activity" })
  addActivity(
    @ZodParams(leadParam) params: { leadId: string },
    @ZodBody(leadActivityCreateRequest) body: LeadActivityCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LeadActivityView> {
    return this.leads.addActivity(params.leadId, body, staffId(principal));
  }

  @Post("leads/:leadId/merge")
  @RequirePermission("crm.leads.update")
  @SelfAudited()
  merge(
    @ZodParams(leadParam) params: { leadId: string },
    @ZodBody(leadMergeRequest) body: LeadMergeRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LeadView> {
    return this.leads.merge(params.leadId, body.survivorLeadId, staffId(principal));
  }
}
