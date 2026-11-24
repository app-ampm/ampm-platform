import { Controller, Delete, Get, HttpCode, Patch, Post, Req } from "@nestjs/common";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  uuid,
  weddingReferenceCreateRequest,
  weddingReferenceUpdateRequest,
  type DocumentLinkView,
  type WeddingReferenceCreateRequest,
  type WeddingReferenceRemovedResponse,
  type WeddingReferenceUpdateRequest,
  type WeddingReferenceView,
} from "@ampm/core";
import type { Request } from "express";
import { z } from "zod";

import { octetStreamBody, readBoundedBody } from "../../common/bounded-body.js";
import { UploadRoute } from "../../common/upload-slot/upload-route.decorator.js";
import { ZodBody, ZodParams } from "../../common/zod.js";
import {
  Audited,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { HotelReferenceConsentService } from "./hotel-reference-consent.service.js";
import { HotelReferencesService } from "./hotel-references.service.js";

const hotelParam = z.object({ hotelId: uuid });
type HotelParam = z.infer<typeof hotelParam>;
const referenceParam = z.object({ hotelId: uuid, referenceId: uuid });
type ReferenceParam = z.infer<typeof referenceParam>;

/**
 * Previous-wedding references for a hotel (HT/SA; feature 9.3), under the `hotels-admin` prefix alongside
 * the other staff hotel routes. Keyed `hotels.wedding_references.*` (read also to SM/PM; create/update/
 * delete to SA/HT). Create is audited by the interceptor; update/delete self-audit the consent/sharing
 * change in a transaction. The GP-20 publishing gate is the service's (a 409 on client visibility
 * without recorded consent); the consent itself arrives only by upload (`…/consent`, the raw bytes) and
 * is viewed through a minted link (`…/consent/link`, SA/HT only: readers see that consent is on file,
 * never the file). The client-facing references are served on the hotel detail, not here.
 */
@Controller("hotels-admin")
export class HotelReferencesController {
  constructor(
    private readonly references: HotelReferencesService,
    private readonly consent: HotelReferenceConsentService,
  ) {}

  @Get("hotels/:hotelId/wedding-references")
  @RequirePermission("hotels.wedding_references.read")
  list(@ZodParams(hotelParam) params: HotelParam): Promise<{ items: WeddingReferenceView[] }> {
    return this.references.list(params.hotelId);
  }

  @Get("hotels/:hotelId/wedding-references/:referenceId")
  @RequirePermission("hotels.wedding_references.read")
  get(@ZodParams(referenceParam) params: ReferenceParam): Promise<WeddingReferenceView> {
    return this.references.get(params.hotelId, params.referenceId);
  }

  @Post("hotels/:hotelId/wedding-references")
  @RequirePermission("hotels.wedding_references.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel_wedding_reference" })
  create(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodBody(weddingReferenceCreateRequest) body: WeddingReferenceCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WeddingReferenceView> {
    return this.references.create(params.hotelId, body, staffId(principal));
  }

  @Patch("hotels/:hotelId/wedding-references/:referenceId")
  @RequirePermission("hotels.wedding_references.update")
  @SelfAudited()
  update(
    @ZodParams(referenceParam) params: ReferenceParam,
    @ZodBody(weddingReferenceUpdateRequest) body: WeddingReferenceUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WeddingReferenceView> {
    return this.references.update(params.hotelId, params.referenceId, body, staffId(principal));
  }

  @Delete("hotels/:hotelId/wedding-references/:referenceId")
  @RequirePermission("hotels.wedding_references.delete")
  @SelfAudited()
  remove(
    @ZodParams(referenceParam) params: ReferenceParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WeddingReferenceRemovedResponse> {
    return this.references.remove(params.hotelId, params.referenceId, staffId(principal));
  }

  // The raw file bytes are the request body (application/octet-stream), read here, after the guards
  // and in an upload slot (D-187); content, not extension, decides type.
  @Post("hotels/:hotelId/wedding-references/:referenceId/consent")
  @HttpCode(200)
  @RequirePermission("hotels.wedding_references.update")
  @UploadRoute()
  @SelfAudited()
  async attachConsent(
    @ZodParams(referenceParam) params: ReferenceParam,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WeddingReferenceView> {
    const bytes = await readBoundedBody(req, octetStreamBody(MAX_DOCUMENT_UPLOAD_BYTES));
    return this.consent.attach(params.hotelId, params.referenceId, bytes, staffId(principal));
  }

  // The consent names the couple: only a role that manages references (SA/HT) opens it, not every reader.
  @Post("hotels/:hotelId/wedding-references/:referenceId/consent/link")
  @HttpCode(201)
  @RequirePermission("hotels.wedding_references.update")
  @SelfAudited()
  consentLink(
    @ZodParams(referenceParam) params: ReferenceParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<DocumentLinkView> {
    return this.consent.link(params.hotelId, params.referenceId, staffId(principal));
  }
}
