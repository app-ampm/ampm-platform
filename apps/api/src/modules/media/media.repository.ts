import { Injectable } from "@nestjs/common";
import type {
  MediaAssetCreateRequest,
  MediaAssetUpdateRequest,
  MediaListQuery,
  MediaScanStatus,
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

  /** The SECRET object key for signing a download — used internally, never returned to a caller. */
  async storageKeyOf(id: string): Promise<string | null> {
    const row = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
      select: { storageKey: true },
    });
    return row ? row.storageKey : null;
  }

  /** Resolve an asset from its object key (the signed download path), for the scan gate and content type. */
  async findByStorageKey(storageKey: string): Promise<MediaAssetRow | null> {
    return this.prisma.mediaAsset.findFirst({
      where: { storageKey, deletedAt: null },
      select: MEDIA_SELECT,
    });
  }

  /** Demote an asset to `pending` (non-downloadable) in a committed write before its bytes change (3b). */
  async markPending(id: string, actorId: string): Promise<void> {
    await this.prisma.mediaAsset.updateMany({
      where: { id, deletedAt: null },
      data: { scanStatus: "pending", updatedBy: actorId },
    });
  }

  /** Record the content-verified type/size and the scan outcome after the bytes are stored (feature 9.3b). */
  async setUploaded(
    id: string,
    data: { mimeType: string; sizeBytes: number; scanStatus: MediaScanStatus },
    actorId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<MediaAssetRow> {
    return (tx ?? this.prisma).mediaAsset.update({
      where: { id },
      data: { ...data, updatedBy: actorId },
      select: MEDIA_SELECT,
    });
  }

  /** Runs `work` in one transaction so a self-audited mutation and its audit event commit together. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
