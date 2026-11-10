import { Injectable } from "@nestjs/common";
import type {
  MediaAssetCreateRequest,
  MediaAssetUpdateRequest,
  MediaListQuery,
  MediaRightsStatus,
  MediaScanStatus,
  MediaVisibility,
} from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";

/*
 * The staff media model — metadata and rights only. The SECRET object keys (storage_key / thumbnail_key /
 * web_key) are never selected here, so they cannot reach any response (security.md: one model per
 * audience, not a hide-flag). Media is polymorphic (owner_type + owner_id, no FK), so this repository
 * scopes by owner and never joins another module's tables (architecture §5, the C→N boundary).
 */
const MEDIA_SELECT = {
  id: true,
  ownerType: true,
  ownerId: true,
  kind: true,
  mimeType: true,
  sizeBytes: true,
  scanStatus: true,
  caption: true,
  sortOrder: true,
  visibility: true,
  rightsStatus: true,
  consentSourceProjectId: true,
  consentDocumentId: true,
  uploadedBy: true,
  createdAt: true,
} as const satisfies Prisma.MediaAssetSelect;

export type MediaAssetRow = Prisma.MediaAssetGetPayload<{ select: typeof MEDIA_SELECT }>;

/*
 * The client-gallery projection (feature 9.3c). Carries the derivative keys so the service can sign links
 * to them — they never leave the service, which maps this row to the key-free MediaGalleryItem. `rights`
 * and `visibility` ride along so the service can apply the GP-20 rights gate as defence in depth.
 */
const GALLERY_SELECT = {
  id: true,
  kind: true,
  caption: true,
  rightsStatus: true,
  thumbnailKey: true,
  webKey: true,
} as const satisfies Prisma.MediaAssetSelect;

export type MediaGalleryRow = Prisma.MediaAssetGetPayload<{ select: typeof GALLERY_SELECT }>;

/*
 * The cover projection (card thumbnails): just the owner id to key the result map and the thumbnail key to
 * sign. Like GALLERY_SELECT the SECRET key never leaves the service. The full client-eligibility gate lives
 * in the query's WHERE so DISTINCT ON returns exactly one ready cover per owner.
 */
const COVER_SELECT = {
  ownerId: true,
  thumbnailKey: true,
} as const satisfies Prisma.MediaAssetSelect;

export type MediaCoverRow = Prisma.MediaAssetGetPayload<{ select: typeof COVER_SELECT }>;

/**
 * How long an upload claim is honoured before it is considered stale and stealable (feature 9.3 slice 5c).
 * Longer than any real upload, short enough that a crashed upload self-heals without operator action.
 */
const UPLOAD_CLAIM_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    request: MediaAssetCreateRequest,
    storageKey: string,
    actorId: string,
  ): Promise<MediaAssetRow> {
    return this.prisma.mediaAsset.create({
      data: {
        ownerType: request.ownerType,
        ownerId: request.ownerId,
        kind: request.kind,
        storageKey,
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        caption: request.caption ?? null,
        sortOrder: request.sortOrder ?? null,
        visibility: request.visibility,
        rightsStatus: request.rightsStatus,
        consentSourceProjectId: request.consentSourceProjectId ?? null,
        consentDocumentId: request.consentDocumentId ?? null,
        uploadedBy: actorId,
        createdBy: actorId,
      },
      select: MEDIA_SELECT,
    });
  }

  async find(id: string): Promise<MediaAssetRow | null> {
    return this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
      select: MEDIA_SELECT,
    });
  }

  async listByOwner(
    ownerType: MediaAssetRow["ownerType"],
    ownerId: string,
    query: MediaListQuery,
  ): Promise<{ rows: MediaAssetRow[]; nextCursor: string | null }> {
    const limit = query.limit;
    const rows = await this.prisma.mediaAsset.findMany({
      where: { ownerType, ownerId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: MEDIA_SELECT,
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { rows: items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }

  async update(
    id: string,
    patch: MediaAssetUpdateRequest,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<MediaAssetRow> {
    return (tx ?? this.prisma).mediaAsset.update({
      where: { id },
      data: {
        caption: patch.caption,
        sortOrder: patch.sortOrder,
        visibility: patch.visibility,
        rightsStatus: patch.rightsStatus,
        consentSourceProjectId: patch.consentSourceProjectId,
        consentDocumentId: patch.consentDocumentId,
        updatedBy: actorId,
      },
      select: MEDIA_SELECT,
    });
  }

  /** Soft-delete if present; idempotent (removing an already-removed asset is a no-op). */
  async softDelete(id: string, actorId: string, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).mediaAsset.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  /**
   * The SECRET object keys for signing a download — used internally, never returned to a caller. The
   * derivative keys are null until the upload path generates them (feature 9.3c); the original is always set.
   */
  async keysOf(
    id: string,
  ): Promise<{ storageKey: string; thumbnailKey: string | null; webKey: string | null } | null> {
    return this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
      select: { storageKey: true, thumbnailKey: true, webKey: true },
    });
  }

  /**
   * Resolve an asset from ANY of its object keys — original or a derivative (feature 9.3c) — for the scan
   * gate and content type on the signed download path. A key cleared on re-upload (markPending) matches
   * nothing, so a link minted against the old bytes stops resolving (fail-closed).
   */
  async findByAnyKey(key: string): Promise<MediaAssetRow | null> {
    return this.prisma.mediaAsset.findFirst({
      where: { deletedAt: null, OR: [{ storageKey: key }, { thumbnailKey: key }, { webKey: key }] },
      select: MEDIA_SELECT,
    });
  }

  /**
   * One owner's gallery-ready media: clean, within the allowed visibility levels (AC-24.4), ordered for
   * display. Soft-deleted and non-clean rows are scoped out here (security.md: repository scoping). The
   * service applies the rights gate and skips rows without derivatives before signing links.
   */
  async listGallery(
    ownerType: MediaAssetRow["ownerType"],
    ownerId: string,
    visibilities: MediaVisibility[],
  ): Promise<MediaGalleryRow[]> {
    return this.prisma.mediaAsset.findMany({
      where: {
        ownerType,
        ownerId,
        deletedAt: null,
        scanStatus: "clean",
        visibility: { in: visibilities },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: GALLERY_SELECT,
    });
  }

  /**
   * One client-eligible cover image per owner for a page of owners (card thumbnails). The whole GP-20 gate is
   * pushed into the WHERE — clean, an image, at or below the audience's visibility, publishable rights, and
   * both derivatives present — so `DISTINCT ON (owner_id)` with the same order listGallery uses returns the
   * single lowest-sortOrder ready image per owner in one round trip (no N+1 across a list). An owner with no
   * eligible image is simply absent from the result. The thumbnail key stays in the service, which signs it.
   */
  async listCovers(
    ownerType: MediaAssetRow["ownerType"],
    ownerIds: string[],
    visibilities: MediaVisibility[],
    rights: MediaRightsStatus[],
  ): Promise<MediaCoverRow[]> {
    if (ownerIds.length === 0) return [];
    return this.prisma.mediaAsset.findMany({
      where: {
        ownerType,
        ownerId: { in: ownerIds },
        deletedAt: null,
        scanStatus: "clean",
        kind: "image",
        visibility: { in: visibilities },
        rightsStatus: { in: rights },
        thumbnailKey: { not: null },
        webKey: { not: null },
      },
      orderBy: [{ ownerId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      distinct: ["ownerId"],
      select: COVER_SELECT,
    });
  }

  /**
   * Claim an asset for upload and demote it in one atomic compare-and-swap (feature 9.3 slice 5c). Acquires
   * only when no upload is in flight (`upload_started_at` null) or a prior claim is older than the stale-steal
   * TTL, so a crashed upload self-heals; on success it also demotes to `pending` and clears the derivative
   * keys (the overwrite -> scan window stays fail-closed, and a link minted while clean stops resolving).
   * Returns false when another upload already holds the claim, so the caller refuses rather than interleaving
   * its storage writes and tearing the rendition set.
   */
  async claimUpload(id: string, actorId: string): Promise<boolean> {
    const staleCutoff = new Date(Date.now() - UPLOAD_CLAIM_TTL_MS);
    const result = await this.prisma.mediaAsset.updateMany({
      where: {
        id,
        deletedAt: null,
        OR: [{ uploadStartedAt: null }, { uploadStartedAt: { lt: staleCutoff } }],
      },
      data: {
        uploadStartedAt: new Date(),
        scanStatus: "pending",
        thumbnailKey: null,
        webKey: null,
        updatedBy: actorId,
      },
    });
    return result.count > 0;
  }

  /** Release the upload claim (feature 9.3 slice 5c) so a retry can proceed at once, before the TTL lapses. */
  async releaseUpload(id: string): Promise<void> {
    await this.prisma.mediaAsset.updateMany({ where: { id }, data: { uploadStartedAt: null } });
  }

  /**
   * Record the content-verified type/size, the scan outcome and (when generated) the derivative keys after
   * the bytes are stored (feature 9.3b/c). `thumbnailKey`/`webKey` are written only when supplied, so a
   * non-image or rejected upload leaves them as markPending cleared them.
   */
  async setUploaded(
    id: string,
    data: {
      mimeType: string;
      sizeBytes: number;
      scanStatus: MediaScanStatus;
      thumbnailKey?: string;
      webKey?: string;
    },
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<MediaAssetRow> {
    return (tx ?? this.prisma).mediaAsset.update({
      where: { id },
      // Releasing the upload claim (upload_started_at -> null) is part of committing the terminal state.
      data: { ...data, uploadStartedAt: null, updatedBy: actorId },
      select: MEDIA_SELECT,
    });
  }

  /** Runs `work` in one transaction so a self-audited mutation and its audit event commit together. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
