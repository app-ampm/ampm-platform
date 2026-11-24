import { DOCUMENT_UPLOAD_TYPES, MAX_DOCUMENT_UPLOAD_BYTES } from "@ampm/core";

/**
 * Content rules for stored documents (Module N, D-132): which file types a document may be, decided by
 * the bytes' magic number and never the client's extension or Content-Type (security.md, AC-20.2), and
 * the size ceiling. Pure constants and functions — no I/O — so the service and its tests share one source.
 * The first document type is a signed contract: a PDF, or a photo or scan of the signed pages.
 */

export interface DetectedDocument {
  readonly mimeType: (typeof DOCUMENT_UPLOAD_TYPES)[number];
  /** The file extension the download is named with (the stored key carries none). */
  readonly extension: "pdf" | "jpg" | "png";
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SIGNATURES: ReadonlyArray<{ detected: DetectedDocument; match: (b: Buffer) => boolean }> = [
  {
    detected: { mimeType: "application/pdf", extension: "pdf" },
    match: (b) => b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  {
    detected: { mimeType: "image/jpeg", extension: "jpg" },
    match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    detected: { mimeType: "image/png", extension: "png" },
    match: (b) => b.length >= 8 && b.subarray(0, 8).equals(PNG),
  },
];

/** The detected document type, or null when the bytes are not an allowed PDF, JPEG or PNG. */
export function detectDocument(bytes: Buffer): DetectedDocument | null {
  return SIGNATURES.find((signature) => signature.match(bytes))?.detected ?? null;
}

/**
 * The flat ceiling for one document (security.md: size limits per document type), one shared constant
 * with the client (core). One value while the signed contract is the only type; per-type limits from
 * `configurations` arrive with the next document type, like media's. The upload routes read their body
 * with this cap (octetStreamBody; D-187), so an oversized file is refused with 413 before it is read;
 * this check stays for any caller that stores bytes another way.
 */
export const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_UPLOAD_BYTES;

/** A download's file name: a fixed, PII-free stem plus the version and the detected extension. */
export function downloadFileName(stem: string, versionNumber: number, mimeType: string): string {
  const extension = SIGNATURES.find((s) => s.detected.mimeType === mimeType)?.detected.extension;
  const version = versionNumber > 1 ? `-v${versionNumber}` : "";
  return `${stem}${version}.${extension ?? "bin"}`;
}
