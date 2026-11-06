import type { MediaAssetView } from "@ampm/core";

import type { MediaAssetRow } from "./media.repository.js";

/**
 * Maps a repository row to the staff media view. The return type is the @ampm/core view, so TypeScript
 * rejects any extra field — the structural guarantee, alongside the repository's key-free select, that the
 * SECRET object keys (storage_key / thumbnail_key / web_key) can never reach a response (security.md).
 */
export function toMediaAssetView(row: MediaAssetRow): MediaAssetView {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    scanStatus: row.scanStatus,
    caption: row.caption,
    sortOrder: row.sortOrder,
    visibility: row.visibility,
    rightsStatus: row.rightsStatus,
    consentSourceProjectId: row.consentSourceProjectId,
    consentDocumentId: row.consentDocumentId,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}
