/**
 * Content-sniffing for uploads (feature 9.3, AC-20.2): the stored type is decided by the bytes' magic
 * number, never the client's extension or Content-Type, so a renamed executable is refused. Only the
 * allowed image and video types are recognised; anything else returns null and the upload is rejected.
 * No dependency — the signatures the hotel gallery needs are a short, well-known set.
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

/** The flat upload ceiling the API buffers and stores (AC-20.2). Per-type config limits are a later slice. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
