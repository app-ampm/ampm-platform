import { MAX_MEDIA_UPLOAD_BYTES, type MediaRightsStatus, type MediaVisibility } from "@ampm/core";

/**
 * Content and rendition rules for gallery media (feature 9.3): how an upload's type is sniffed, how its
 * derivatives are sized and keyed, and which visibility/rights values may reach a client. Pure constants
 * and functions — no I/O, no Prisma — so the service and its tests share one source of these rules.
 * Content-sniffing (AC-20.2) decides the stored type from the bytes' magic number, never the client's
 * extension or Content-Type, so a renamed executable is refused; no sniffing library is needed.
 */

export interface DetectedMedia {
  readonly mimeType: string;
  readonly kind: "image" | "video";
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ascii = (bytes: Buffer, start: number, end: number): string =>
  bytes.subarray(start, end).toString("ascii");

const SIGNATURES: ReadonlyArray<{ detected: DetectedMedia; match: (b: Buffer) => boolean }> = [
  {
    detected: { mimeType: "image/jpeg", kind: "image" },
    match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    detected: { mimeType: "image/png", kind: "image" },
    match: (b) => b.length >= 8 && b.subarray(0, 8).equals(PNG),
  },
  {
    detected: { mimeType: "image/webp", kind: "image" },
    match: (b) => b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  },
  {
    detected: { mimeType: "image/gif", kind: "image" },
    match: (b) => b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a"),
  },
  {
    detected: { mimeType: "video/mp4", kind: "video" },
    match: (b) => b.length >= 12 && ascii(b, 4, 8) === "ftyp",
  },
];

/** The detected media type, or null when the bytes are not an allowed image or video (AC-20.2). */
export function detectMedia(bytes: Buffer): DetectedMedia | null {
  const hit = SIGNATURES.find((signature) => signature.match(bytes));
  return hit ? hit.detected : null;
}

/** The flat upload ceiling the API buffers and stores (AC-20.2); one shared constant with the client (core). */
export const MAX_UPLOAD_BYTES = MAX_MEDIA_UPLOAD_BYTES;

/**
 * The image types the derivative step can downscale and re-encode (feature 9.3c, AC-24.1). GIF is
 * excluded — its animation needs a different path — and video is a separate concern (AC-24.2). A type
 * outside this set keeps only its original and never reaches the client gallery, which serves a derivative.
 */
const DERIVABLE_IMAGE_MIMES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Whether a detected upload can have web/thumbnail derivatives generated (AC-24.1). */
export function isDerivableImage(detected: DetectedMedia): boolean {
  return detected.kind === "image" && DERIVABLE_IMAGE_MIMES.has(detected.mimeType);
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
