import { Controller, Get, HttpCode, Patch, Post, Req } from "@nestjs/common";
import {
  errors,
  serviceAgreementCreateRequest,
  serviceAgreementListQuery,
  serviceAgreementTransitionRequest,
  serviceAgreementUpdateRequest,
  uuid,
  type DocumentLinkView,
  type ServiceAgreementCreateRequest,
  type ServiceAgreementListQuery,
  type ServiceAgreementStaffPage,
  type ServiceAgreementStaffView,
  type ServiceAgreementTransitionRequest,
  type ServiceAgreementUpdateRequest,
} from "@ampm/core";
import type { Request } from "express";
import { z } from "zod";

import { RateLimit } from "../../../common/rate-limit/rate-limit.decorator.js";
import { UPLOADS } from "../../../common/rate-limit/route-limits.js";
import type { Access } from "../../../common/request-context.js";
import { ZodBody, ZodParams, ZodQuery } from "../../../common/zod.js";
import {
  CurrentAccess,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { AgreementSignedCopyService } from "./agreement-signed-copy.service.js";
import { ServiceAgreementsService } from "./service-agreements.service.js";

const agreementParam = z.object({ agreementId: uuid });

/**
 * The staff workspace for paid-service agreements (feature 10.2), keyed on `crm.service_agreements.*`
 * and scoped through `@CurrentAccess` (SA full, SM create/read/update, FA read). HT's hotel-only
 * condition and PM's assigned scope are not yet route-reachable (no route-level subject, no projects
 * until module E) — the import_jobs precedent. Writes self-audit inside their service transaction.
 * Staff never accept through the status route: the client accepts in the portal, and an agreement signed
 * outside the app is recorded by attaching its signed copy (`POST …/signed-copy`).
 */
@Controller("crm")
export class ServiceAgreementsController {
  constructor(
    private readonly agreements: ServiceAgreementsService,
    private readonly signedCopies: AgreementSignedCopyService,
  ) {}

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

  // The raw file bytes are the request body (application/octet-stream); content, not extension, decides type.
  @Post("service-agreements/:agreementId/signed-copy")
  @HttpCode(200)
  @RequirePermission("crm.service_agreements.update")
  @RateLimit(UPLOADS)
  @SelfAudited()
  markSignedOffline(
    @ZodParams(agreementParam) params: { agreementId: string },
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<ServiceAgreementStaffView> {
    if (!Buffer.isBuffer(req.body)) {
      throw errors.validation(
        [],
        "Send the signed copy's raw bytes as the request body (application/octet-stream)",
      );
    }
    return this.signedCopies.markSignedOffline(principal, access, params.agreementId, req.body);
  }

  @Post("service-agreements/:agreementId/signed-copy/link")
  @HttpCode(201)
  @RequirePermission("crm.service_agreements.read")
  @SelfAudited()
  signedCopyLink(
    @ZodParams(agreementParam) params: { agreementId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<DocumentLinkView> {
    return this.signedCopies.link(principal, access, params.agreementId);
  }
}
