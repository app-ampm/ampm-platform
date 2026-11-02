import { Controller, Delete, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  mediaAssetCreateRequest,
  mediaAssetUpdateRequest,
  mediaListQuery,
  uuid,
  type MediaAssetCreateRequest,
  type MediaAssetPage,
  type MediaAssetUpdateRequest,
  type MediaAssetView,
  type MediaListQuery,
  type MediaRemovedResponse,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import {
  Audited,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { MediaService } from "./media.service.js";

const mediaParam = z.object({ mediaId: uuid });
type MediaParam = z.infer<typeof mediaParam>;

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Gallery media management (HT/SA; Module N, feature 9.3). The resource is `hotels.hotel_media_rights_status`
 * (permission-matrix §5.3). Create is audited by the interceptor; update and delete self-audit. The
 * signed-URL download path and the upload path are a following slice (3b); this is the record + rights
 * surface only.
 */
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @RequirePermission("hotels.hotel_media_rights_status.create")
  @HttpCode(201)
  @Audited({ entityType: "media_asset" })
  create(
    @ZodBody(mediaAssetCreateRequest) body: MediaAssetCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MediaAssetView> {
    return this.media.create(body, staffId(principal));
  }

  @Get()
  @RequirePermission("hotels.hotel_media_rights_status.read")
  list(@ZodQuery(mediaListQuery) query: MediaListQuery): Promise<MediaAssetPage> {
    return this.media.list(query);
  }

  @Get(":mediaId")
  @RequirePermission("hotels.hotel_media_rights_status.read")
  get(@ZodParams(mediaParam) params: MediaParam): Promise<MediaAssetView> {
    return this.media.get(params.mediaId);
  }

  @Patch(":mediaId")
  @RequirePermission("hotels.hotel_media_rights_status.update")
  @SelfAudited()
  update(
    @ZodParams(mediaParam) params: MediaParam,
    @ZodBody(mediaAssetUpdateRequest) body: MediaAssetUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MediaAssetView> {
    return this.media.update(params.mediaId, body, staffId(principal));
  }

  @Delete(":mediaId")
  @RequirePermission("hotels.hotel_media_rights_status.delete")
  @SelfAudited()
  remove(
    @ZodParams(mediaParam) params: MediaParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MediaRemovedResponse> {
    return this.media.remove(params.mediaId, staffId(principal));
  }
}
