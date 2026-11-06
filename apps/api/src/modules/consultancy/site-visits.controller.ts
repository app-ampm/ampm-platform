import { Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  siteVisitCreateRequest,
  siteVisitListQuery,
  siteVisitTransitionRequest,
  siteVisitUpdateRequest,
  uuid,
  type SiteVisitCreateRequest,
  type SiteVisitListQuery,
  type SiteVisitStaffPage,
  type SiteVisitStaffView,
  type SiteVisitTransitionRequest,
  type SiteVisitUpdateRequest,
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
import { SiteVisitsService } from "./site-visits.service.js";

const visitParam = z.object({ visitId: uuid });

/**
 * The Hotel-team site-visit workspace (feature 10.3), keyed on `consultancy.site_visits.*` and scoped
 * through `@CurrentAccess` (SA/HT CRU, SM read, PM(a)). Writes self-audit inside their service
 * transaction. Scheduling a visit also advances its enquiry to `visit_scheduled` (10.1 machine).
 */
@Controller("consultancy-admin")
export class SiteVisitsController {
  constructor(private readonly visits: SiteVisitsService) {}

  @Get("site-visits")
  @RequirePermission("consultancy.site_visits.read")
  list(
    @ZodQuery(siteVisitListQuery) query: SiteVisitListQuery,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<SiteVisitStaffPage> {
    return this.visits.list(principal, access, query);
  }

  @Get("site-visits/:visitId")
  @RequirePermission("consultancy.site_visits.read")
  get(
    @ZodParams(visitParam) params: { visitId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<SiteVisitStaffView> {
    return this.visits.get(principal, access, params.visitId);
  }

  @Post("site-visits")
  @HttpCode(201)
  @RequirePermission("consultancy.site_visits.create")
  @SelfAudited()
  create(
    @ZodBody(siteVisitCreateRequest) body: SiteVisitCreateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<SiteVisitStaffView> {
    return this.visits.create(principal, access, body);
  }

  @Patch("site-visits/:visitId")
  @RequirePermission("consultancy.site_visits.update")
  @SelfAudited()
  update(
    @ZodParams(visitParam) params: { visitId: string },
    @ZodBody(siteVisitUpdateRequest) body: SiteVisitUpdateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<SiteVisitStaffView> {
    return this.visits.update(principal, access, params.visitId, body);
  }

  @Patch("site-visits/:visitId/status")
  @RequirePermission("consultancy.site_visits.update")
  @SelfAudited()
  transition(
    @ZodParams(visitParam) params: { visitId: string },
    @ZodBody(siteVisitTransitionRequest) body: SiteVisitTransitionRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<SiteVisitStaffView> {
    return this.visits.transition(principal, access, params.visitId, body);
  }
}
