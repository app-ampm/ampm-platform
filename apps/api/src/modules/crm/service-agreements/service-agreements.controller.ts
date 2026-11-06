import { Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  serviceAgreementCreateRequest,
  serviceAgreementListQuery,
  serviceAgreementTransitionRequest,
  serviceAgreementUpdateRequest,
  uuid,
  type ServiceAgreementCreateRequest,
  type ServiceAgreementListQuery,
  type ServiceAgreementStaffPage,
  type ServiceAgreementStaffView,
  type ServiceAgreementTransitionRequest,
  type ServiceAgreementUpdateRequest,
} from "@ampm/core";
import { z } from "zod";

import type { Access } from "../../../common/request-context.js";
import { ZodBody, ZodParams, ZodQuery } from "../../../common/zod.js";
import {
  CurrentAccess,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { ServiceAgreementsService } from "./service-agreements.service.js";

const agreementParam = z.object({ agreementId: uuid });

/**
 * The staff workspace for paid-service agreements (feature 10.2), keyed on `crm.service_agreements.*`
 * and scoped through `@CurrentAccess` (SA full, SM create/read/update, FA read). HT's hotel-only
 * condition and PM's assigned scope are not yet route-reachable (no route-level subject, no projects
 * until module E) — the import_jobs precedent. Writes self-audit inside their service transaction.
 */
@Controller("crm")
export class ServiceAgreementsController {
  constructor(private readonly agreements: ServiceAgreementsService) {}

  @Get("service-agreements")
  @RequirePermission("crm.service_agreements.read")
  list(
    @ZodQuery(serviceAgreementListQuery) query: ServiceAgreementListQuery,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<ServiceAgreementStaffPage> {
    return this.agreements.list(principal, access, query);
  }

  @Get("service-agreements/:agreementId")
  @RequirePermission("crm.service_agreements.read")
  get(
    @ZodParams(agreementParam) params: { agreementId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<ServiceAgreementStaffView> {
    return this.agreements.get(principal, access, params.agreementId);
  }

  @Post("service-agreements")
  @HttpCode(201)
  @RequirePermission("crm.service_agreements.create")
  @SelfAudited()
  create(
    @ZodBody(serviceAgreementCreateRequest) body: ServiceAgreementCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ServiceAgreementStaffView> {
    return this.agreements.create(principal, body);
  }

  @Patch("service-agreements/:agreementId")
  @RequirePermission("crm.service_agreements.update")
  @SelfAudited()
  update(
    @ZodParams(agreementParam) params: { agreementId: string },
    @ZodBody(serviceAgreementUpdateRequest) body: ServiceAgreementUpdateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<ServiceAgreementStaffView> {
    return this.agreements.updateTerms(principal, access, params.agreementId, body);
  }

  @Patch("service-agreements/:agreementId/status")
  @RequirePermission("crm.service_agreements.update")
  @SelfAudited()
  transition(
    @ZodParams(agreementParam) params: { agreementId: string },
    @ZodBody(serviceAgreementTransitionRequest) body: ServiceAgreementTransitionRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<ServiceAgreementStaffView> {
    return this.agreements.transition(principal, access, params.agreementId, body);
  }
}
