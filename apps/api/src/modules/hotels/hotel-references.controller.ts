import { Controller, Delete, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  uuid,
  weddingReferenceCreateRequest,
  weddingReferenceUpdateRequest,
  type WeddingReferenceCreateRequest,
  type WeddingReferenceRemovedResponse,
  type WeddingReferenceUpdateRequest,
  type WeddingReferenceView,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../common/zod.js";
import {
  Audited,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelReferencesService } from "./hotel-references.service.js";

const hotelParam = z.object({ hotelId: uuid });
type HotelParam = z.infer<typeof hotelParam>;
const referenceParam = z.object({ hotelId: uuid, referenceId: uuid });
type ReferenceParam = z.infer<typeof referenceParam>;

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Previous-wedding references for a hotel (HT/SA; feature 9.3), under the `hotels-admin` prefix alongside
 * the other staff hotel routes. Keyed `hotels.wedding_references.*` (read also to SM/PM; create/update/
 * delete to SA/HT). Create is audited by the interceptor; update/delete self-audit the consent/sharing
 * change in a transaction. The GP-20 publishing gate is the service's (a 409 on client visibility
 * without recorded consent). The client-facing references are served on the hotel detail, not here.
 */
@Controller("hotels-admin")
export class HotelReferencesController {
  constructor(private readonly references: HotelReferencesService) {}

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
}
