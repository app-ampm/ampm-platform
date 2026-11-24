import { Controller, Delete, Get, HttpCode, Patch, Post, Req, Res } from "@nestjs/common";
import {
  MAX_MEDIA_UPLOAD_BYTES,
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

import { octetStreamBody, readBoundedBody } from "../../common/bounded-body.js";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { UploadRoute } from "../../common/upload-slot/upload-route.decorator.js";
import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import {
  Audited,
  CurrentPrincipal,
  Public,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
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

/**
 * Gallery media (Module N, feature 9.3). Staff CRUD + upload + a minted download link are
 * `hotels.hotel_media_rights_status.*`; `GET /media/blob` is the public, signature-verified byte stream a
 * minted link points at (never a permanent path — security.md). `blob` is declared before `:mediaId` so it
 * is not read as an id. Create is audited by the interceptor; update, delete and upload self-audit.
 * `blob` is limited per network and fails open (a gallery loads many images; the signature is the
 * gate); an upload shares the staff upload limit, which fails closed (D-149), and reads its file after
 * the guards, in an upload slot (D-187).
 */
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // Declared before `:mediaId` so "blob" resolves here, not to the detail handler.
  @Get("blob")
  @Public()
  @RateLimit({ name: "media.blob", limit: 600, windowMs: 60_000, failClosed: false })
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

  // The raw file bytes are the request body (application/octet-stream), read here, after the guards
  // and in an upload slot (D-187); content, not extension, decides type.
  @Post(":mediaId/upload")
  @RequirePermission("hotels.hotel_media_rights_status.update")
  @UploadRoute()
  @HttpCode(200)
  @SelfAudited()
  async upload(
    @ZodParams(mediaParam) params: MediaParam,
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MediaAssetView> {
    const bytes = await readBoundedBody(req, octetStreamBody(MAX_MEDIA_UPLOAD_BYTES));
    return this.media.uploadBytes(params.mediaId, bytes, staffId(principal));
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
