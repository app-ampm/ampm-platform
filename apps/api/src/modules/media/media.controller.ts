import { Controller, Delete, Get, HttpCode, Patch, Post, Req, Res } from "@nestjs/common";
import {
  errors,
  mediaAssetCreateRequest,
  mediaAssetUpdateRequest,
  mediaDownloadQuery,
  mediaListQuery,
  uuid,
  type MediaAssetCreateRequest,
  type MediaAssetPage,
  type MediaAssetUpdateRequest,
  type MediaAssetView,
  type MediaDownloadQuery,
  type MediaDownloadUrl,
  type MediaListQuery,
  type MediaRemovedResponse,
} from "@ampm/core";
import type { Request, Response } from "express";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import {
  Audited,
  CurrentPrincipal,
  Public,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { MediaService } from "./media.service.js";

const mediaParam = z.object({ mediaId: uuid });
type MediaParam = z.infer<typeof mediaParam>;

// The signed-download query the storage adapter mints: the object key, its expiry and the HMAC signature.
const blobQuery = z.object({
  key: z.string().min(1),
  exp: z.coerce.number().int().positive(),
  sig: z.string().min(1),
});
type BlobQuery = z.infer<typeof blobQuery>;

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Gallery media (Module N, feature 9.3). Staff CRUD + upload + a minted download link are
 * `hotels.hotel_media_rights_status.*`; `GET /media/blob` is the public, signature-verified byte stream a
 * minted link points at (never a permanent path — security.md). `blob` is declared before `:mediaId` so it
 * is not read as an id. Create is audited by the interceptor; update, delete and upload self-audit.
 */
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // Declared before `:mediaId` so "blob" resolves here, not to the detail handler.
  @Get("blob")
  @Public()
  async blob(@ZodQuery(blobQuery) query: BlobQuery, @Res() res: Response): Promise<void> {
    const { bytes, mimeType } = await this.media.streamBlob(query.key, query.exp, query.sig);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=900");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  }

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

  @Get(":mediaId/download-url")
  @RequirePermission("hotels.hotel_media_rights_status.read")
  downloadUrl(
    @ZodParams(mediaParam) params: MediaParam,
    @ZodQuery(mediaDownloadQuery) query: MediaDownloadQuery,
  ): Promise<MediaDownloadUrl> {
    return this.media.downloadUrlFor(params.mediaId, query.variant);
  }

  @Get(":mediaId")
  @RequirePermission("hotels.hotel_media_rights_status.read")
  get(@ZodParams(mediaParam) params: MediaParam): Promise<MediaAssetView> {
    return this.media.get(params.mediaId);
  }

  // The raw file bytes are the request body (application/octet-stream); content, not extension, decides type.
  @Post(":mediaId/upload")
  @RequirePermission("hotels.hotel_media_rights_status.update")
  @HttpCode(200)
  @SelfAudited()
  upload(
    @ZodParams(mediaParam) params: MediaParam,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MediaAssetView> {
    if (!Buffer.isBuffer(req.body)) {
      throw errors.validation(
        [],
        "Send the raw file bytes as the request body (application/octet-stream)",
      );
    }
    return this.media.uploadBytes(params.mediaId, req.body, staffId(principal));
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
