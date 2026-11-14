import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";

/*
 * Contracts for gallery media (Module N `media_assets`; data-model.md §16, feature 9.3). Media is
 * polymorphic — `ownerType`/`ownerId` name the owning record (a hotel for 9.3) — and managed by staff
 * (HT/SA; `hotels.hotel_media_rights_status.*`). The raw object keys (`storage_key`/`thumbnail_key`/
 * `web_key`) are SECRET and never appear on the wire in any view: a file is reached only through a
 * short-lived signed URL (security.md, AC-20), minted by the download path (slice 3b). The GP-20 rule —
 * client/demo/public visibility requires `rights_status` owned|licensed|consent_obtained — is a service
 * guard, not a field. Bytes arrive through the upload path (slice 3b); a row starts `pending` and is not
 * downloadable until a scan passes (fail-closed).
 */

export const mediaKind = z.enum(["image", "video"]);
export type MediaKind = z.infer<typeof mediaKind>;

export const mediaVisibility = z.enum(["internal", "client", "demo", "public"]);
export type MediaVisibility = z.infer<typeof mediaVisibility>;

export const mediaRightsStatus = z.enum([
  "owned",
  "licensed",
  "consent_required",
  "consent_obtained",
]);
export type MediaRightsStatus = z.infer<typeof mediaRightsStatus>;

export const mediaScanStatus = z.enum(["pending", "clean", "rejected"]);
export type MediaScanStatus = z.infer<typeof mediaScanStatus>;

export const mediaOwnerType = z.enum([
  "hotel",
  "destination",
  "vendor",
  "design_version",
  "invitation_version",
  "project",
  "cms",
]);
export type MediaOwnerType = z.infer<typeof mediaOwnerType>;

/**
 * A media asset as staff manage it (HT/SA). Strict; the SECRET object keys are absent by construction —
 * the response model carries only metadata and rights, never a storage key (one model per audience,
 * security.md). `scanStatus` is read-only operational state; only `clean` is ever downloadable.
 */
export const mediaAssetView = z
  .object({
    id: uuid,
    ownerType: mediaOwnerType,
    ownerId: uuid,
    kind: mediaKind,
    mimeType: z.string(),
    sizeBytes: z.number().int(),
    scanStatus: mediaScanStatus,
    caption: z.string().nullable(),
    sortOrder: z.number().int().nullable(),
    visibility: mediaVisibility,
    rightsStatus: mediaRightsStatus,
    consentSourceProjectId: uuid.nullable(),
    consentDocumentId: uuid.nullable(),
    uploadedBy: uuid,
    createdAt: isoDateTime,
  })
  .strict();
export type MediaAssetView = z.infer<typeof mediaAssetView>;

/**
 * Register a media asset against an owner (create-by-reference). The server generates the object key; the
 * client never supplies one. The bytes are uploaded afterwards (slice 3b), so the row starts `pending`.
 */
export const mediaAssetCreateRequest = z
  .object({
    ownerType: mediaOwnerType,
    ownerId: uuid,
    kind: mediaKind,
    // The caller declares the file's type and size at registration; the upload path verifies them by
    // content and corrects the row (slice 3b, AC-20.2). The importer attaches media by reference the same way.
    mimeType: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().min(0),
    caption: z.string().trim().max(255).nullish(),
    sortOrder: z.number().int().min(0).nullish(),
    visibility: mediaVisibility.default("internal"),
    rightsStatus: mediaRightsStatus.default("consent_required"),
    consentSourceProjectId: uuid.nullish(),
    consentDocumentId: uuid.nullish(),
  })
  .strict();
export type MediaAssetCreateRequest = z.infer<typeof mediaAssetCreateRequest>;

// No-default base, so the update (a `.partial()` of these) never leaks a create default (data.md pattern).
const mediaAssetFields = {
  caption: z.string().trim().max(255).nullish(),
  sortOrder: z.number().int().min(0).nullish(),
  visibility: mediaVisibility,
  rightsStatus: mediaRightsStatus,
  consentSourceProjectId: uuid.nullish(),
  consentDocumentId: uuid.nullish(),
};

export const mediaAssetUpdateRequest = z
  .object(mediaAssetFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type MediaAssetUpdateRequest = z.infer<typeof mediaAssetUpdateRequest>;

/** List one owner's media (staff), cursor-paginated by media id. Reach is the owner, not a param a client sets. */
export const mediaListQuery = cursorQuery.extend({
  cursor: uuid.optional(),
  ownerType: mediaOwnerType,
  ownerId: uuid,
});
export type MediaListQuery = z.infer<typeof mediaListQuery>;

export const mediaAssetPage = page(mediaAssetView);
export type MediaAssetPage = z.infer<typeof mediaAssetPage>;

/** The acknowledgement after removing a media asset (soft delete is idempotent — returns its id). */
export const mediaRemovedResponse = z.object({ id: uuid }).strict();
export type MediaRemovedResponse = z.infer<typeof mediaRemovedResponse>;

/**
 * A signed, expiring link to download a media asset's bytes (AC-20). Minted only for a `clean` asset,
 * in an authorised read context (access follows the owning record); the URL itself is the capability and
 * the object key never appears on the wire.
 */
export const mediaDownloadUrl = z.object({ url: z.string(), expiresAt: isoDateTime }).strict();
export type MediaDownloadUrl = z.infer<typeof mediaDownloadUrl>;

/**
 * Which stored rendition of an image a download link is minted for (AC-24.1). The `original` is always
 * kept; `web` and `thumbnail` are the metadata-stripped derivatives the gallery serves (CP-05). A
 * derivative that was never generated (a video, or an asset uploaded before derivatives) is a 404.
 */
export const mediaVariant = z.enum(["original", "web", "thumbnail"]);
export type MediaVariant = z.infer<typeof mediaVariant>;

export const mediaDownloadQuery = z.object({ variant: mediaVariant.default("original") }).strict();
export type MediaDownloadQuery = z.infer<typeof mediaDownloadQuery>;

/**
 * One image as a client/demo principal sees it in a gallery (CP-05). The object keys never appear — only
 * short-lived signed links to the metadata-stripped derivatives (security.md, AC-20). Rights, visibility,
 * scan state and size stay server-side: a client sees a picture, not its governance. Reused by every
 * owner's gallery (a hotel for 9.3, a vendor portfolio later), so it carries no owner-specific field.
 */
export const mediaGalleryItem = z
  .object({
    id: uuid,
    kind: mediaKind,
    caption: z.string().nullable(),
    thumbnailUrl: z.string(), // signed link to the thumbnail derivative
    webUrl: z.string(), // signed link to the web-size derivative
  })
  .strict();
export type MediaGalleryItem = z.infer<typeof mediaGalleryItem>;

/**
 * One client-visible video as a gallery shows it (feature 9.3c). A video has no web/thumbnail derivative
 * (AC-24.1 renders images only), so there is no poster — just the caption and a short-lived signed link to
 * the original the player streams. The object key never crosses the boundary (security.md), only the link.
 */
export const mediaVideoItem = z
  .object({
    id: uuid,
    caption: z.string().nullable(),
    url: z.string(), // signed link to the original (a video has no derivative)
  })
  .strict();
export type MediaVideoItem = z.infer<typeof mediaVideoItem>;
