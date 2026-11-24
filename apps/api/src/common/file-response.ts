import type { Response } from "express";

/** A stored file as a byte route serves it. */
export interface ServedFile {
  readonly bytes: Buffer;
  /** The type detected from the bytes at upload, never the one the uploader declared. */
  readonly mimeType: string;
  /** A fixed, PII-free name with the detected extension. */
  readonly fileName: string;
  /** The route's own caching. */
  readonly cacheControl: string;
}

/** The raster images a browser shows inline: in a sandbox, so even a crafted one runs nothing. */
const RASTER_IMAGES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Serves a stored file restrictively (D-187 §5; plan §4.5, "Serving outsiders' files"): files come from
 * outside AMPM onto the origin where the portal keeps staff and client tokens. So a file goes out under
 * its detected type with nosniff; with a policy under which it loads and runs nothing
 * (`default-src 'none'`), sandboxed when it is a raster image (a PDF is not sandboxed until HF-G11 checks
 * each browser's viewer; its scripts are refused at upload); to same-site pages only; and inline only
 * when it is a PDF or a raster image, every other type (Office files, videos) as a download.
 *
 * @example
 * sendFile(res, { ...blob, cacheControl: "private, no-store" }); // blob: bytes, mimeType, fileName
 */
export function sendFile(res: Response, file: ServedFile): void {
  const raster = RASTER_IMAGES.has(file.mimeType);
  const inline = raster || file.mimeType === "application/pdf";
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    raster ? "default-src 'none'; sandbox" : "default-src 'none'",
  );
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${file.fileName}"`,
  );
  res.setHeader("Cache-Control", file.cacheControl);
  res.send(file.bytes);
}
