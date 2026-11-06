import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  serviceAgreementAcceptRequest,
  serviceAgreementListQuery,
  uuid,
  type ServiceAgreementClientPage,
  type ServiceAgreementClientView,
  type ServiceAgreementListQuery,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../../common/zod.js";
import { CurrentPrincipal, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { ServiceAgreementsClientService } from "./service-agreements-client.service.js";

const agreementParam = z.object({ agreementId: uuid });

/**
 * The client portal's view of the agreements AMPM has sent them, and the accept action (CP, GP-5).
 * Authenticated but not permission-keyed — the service scopes to the caller's own account and answers
 * 404 to everyone else (the portal pattern). The accept is NOT entitlement-gated (accepting is how the
 * client earns `hotel_assistance`); it self-audits inside the shared transition's transaction.
 */
@Controller("crm/portal")
export class ServiceAgreementsClientController {
  constructor(private readonly agreements: ServiceAgreementsClientService) {}

  @Get("service-agreements")
  list(
    @ZodQuery(serviceAgreementListQuery) query: ServiceAgreementListQuery,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ServiceAgreementClientPage> {
    return this.agreements.listOwn(principal, query);
  }

  @Get("service-agreements/:agreementId")
  get(
    @ZodParams(agreementParam) params: { agreementId: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<ServiceAgreementClientView> {
    return this.agreements.getOwn(principal, params.agreementId);
  }

  @Post("service-agreements/:agreementId/accept")
  @HttpCode(200)
  @SelfAudited()
  accept(
    @ZodParams(agreementParam) params: { agreementId: string },
    @ZodBody(serviceAgreementAcceptRequest) _body: unknown,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ServiceAgreementClientView> {
    return this.agreements.accept(principal, params.agreementId);
  }
}
