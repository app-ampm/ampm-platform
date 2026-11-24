import {
  CONTENT_KINDS,
  contentKindOfMimeType,
  MAX_MEDIA_UPLOAD_BYTES,
  type ContentKind,
  type MediaKind,
  type MediaRightsStatus,
  type MediaVisibility,
} from "@ampm/core";

/**
 * Content and rendition rules for gallery media (feature 9.3): which kinds of file an asset takes, how
 * its derivatives are sized and keyed, and which visibility/rights values may reach a client. Pure
 * constants and functions — no I/O, no Prisma — so the service and its tests share one source of these
 * rules. An upload's kind is decided from its bytes by the content checks (D-187 §2,
 * `documents/content/inspect-content.ts`), never by the client's extension or Content-Type, so a renamed
 * executable, a HEIF or AVIF photo and a polyglot are refused.
 */

/**
 * The kinds an asset of each declared kind takes (AC-20.2, D-187 §2). Every ISO media file that is not a
 * HEIF or AVIF photo is a video, kept and served as MP4, a QuickTime MOV (`qt` brand) included, as before.
 */
export const MEDIA_CONTENT_KINDS: Readonly<Record<MediaKind, readonly ContentKind[]>> = {
  image: ["jpeg", "png", "webp", "gif"],
  video: ["mp4"],
};

/**
 * A media file's name as it is served (D-187 §5): a fixed, PII-free stem by kind and the extension of
 * its detected type; `media.bin` for a type the gallery does not take.
 */
export function mediaFileName(mimeType: string): string {
  const kind = contentKindOfMimeType(mimeType);
  if (!kind || !Object.values(MEDIA_CONTENT_KINDS).some((kinds) => kinds.includes(kind))) {
    return "media.bin";
  }
  return `${kind === "mp4" ? "video" : "image"}.${CONTENT_KINDS[kind].extension}`;
}

/** The flat upload ceiling the API buffers and stores (AC-20.2); one shared constant with the client (core). */
export const MAX_UPLOAD_BYTES = MAX_MEDIA_UPLOAD_BYTES;

/**
 * The image kinds the derivative step can downscale and re-encode (feature 9.3c, AC-24.1). GIF is
 * excluded — its animation needs a different path — and video is a separate concern (AC-24.2). A kind
 * outside this set keeps only its original and never reaches the client gallery, which serves a derivative.
 */
const DERIVABLE_IMAGE_KINDS: ReadonlySet<ContentKind> = new Set(["jpeg", "png", "webp"]);

/** Whether an upload of this kind can have web/thumbnail derivatives generated (AC-24.1). */
export function isDerivableImage(kind: ContentKind): boolean {
  return DERIVABLE_IMAGE_KINDS.has(kind);
}

/**
 * A best-effort MIME type for an image named by reference in the importer (feature 9.3 slice 5b). The
 * pending row declares it; the upload path later corrects it from the bytes' content (AC-20.2), so an
 * unknown extension falls back to image/jpeg rather than guessing wrong.
 */
export function mimeForRef(ref: string): string {
  const lower = ref.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Longest-edge ceilings for the stored derivatives (AC-24.1). The original is always kept alongside. */
export const WEB_MAX_EDGE = 1600;
export const THUMBNAIL_MAX_EDGE = 400;

/** The object keys of a clean image's stored derivatives; empty for a video, gif or rejected upload. */
export type DerivativeKeys = { thumbnailKey?: string; webKey?: string };

/** The in-memory renditions derived from an upload before anything is stored; null for a non-derivable file. */
export type Renditions = { web: Buffer; thumbnail: Buffer };

// The derivative keys are SIBLINGS of the original (a suffix, not a child path): the original is a stored
// object, so a child key like `${storageKey}/web` would collide with it on a filesystem store (the parent of
// the child is the original file itself). A suffix keeps both objects under the same container.
export const webKeyOf = (storageKey: string): string => `${storageKey}.web`;
export const thumbnailKeyOf = (storageKey: string): string => `${storageKey}.thumb`;

/**
 * The visibility levels a principal may see in a gallery, "at or below" their own (AC-24.4). The chain is
 * public < demo < client < internal: a demo prospect sees demo and public, a client sees those plus client,
 * and internal never reaches either — so the two audiences enumerate exactly their allowed levels.
 */
export const CLIENT_VISIBILITIES: readonly MediaVisibility[] = ["public", "demo", "client"];
export const DEMO_VISIBILITIES: readonly MediaVisibility[] = ["public", "demo"];

/** Rights statuses that may back client/demo/public visibility (GP-20). */
export const PUBLISHABLE_RIGHTS: ReadonlySet<MediaRightsStatus> = new Set([
  "owned",
  "licensed",
  "consent_obtained",
]);
