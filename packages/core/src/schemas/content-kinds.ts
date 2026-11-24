import { z } from "zod";

/*
 * The kinds of file AMPM's upload content checks recognise (D-187 §2), as pure data shared by the API,
 * which decides a file's kind from its bytes, and the apps, which name the kinds an upload takes. A kind
 * is decided by the bytes, never by a file's name or its declared type: the families by their first
 * bytes, Office packages by their main part, compound files by their main stream.
 */

/**
 * Every kind a file can be found to be.
 *
 * @example
 * contentKind.parse("pptx"); // "pptx"
 */
export const contentKind = z.enum([
  "pdf",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "pptx",
  "ppsx",
  "potx",
  "ppt",
  "xlsx",
  "xltx",
  "xls",
]);
export type ContentKind = z.infer<typeof contentKind>;

/** How a kind is stored and served: its media type, and the extension a download is named with. */
export interface ContentKindInfo {
  readonly mimeType: string;
  readonly extension: string;
}

/**
 * The served type and download extension of every kind.
 *
 * @example
 * CONTENT_KINDS.pptx.extension; // "pptx"
 */
export const CONTENT_KINDS: Readonly<Record<ContentKind, ContentKindInfo>> = {
  pdf: { mimeType: "application/pdf", extension: "pdf" },
  jpeg: { mimeType: "image/jpeg", extension: "jpg" },
  png: { mimeType: "image/png", extension: "png" },
  webp: { mimeType: "image/webp", extension: "webp" },
  gif: { mimeType: "image/gif", extension: "gif" },
  mp4: { mimeType: "video/mp4", extension: "mp4" },
  pptx: {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
  },
  ppsx: {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    extension: "ppsx",
  },
  potx: {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.template",
    extension: "potx",
  },
  ppt: { mimeType: "application/vnd.ms-powerpoint", extension: "ppt" },
  xlsx: {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  },
  xltx: {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
    extension: "xltx",
  },
  xls: { mimeType: "application/vnd.ms-excel", extension: "xls" },
};

/**
 * The kind a stored media type names (each kind has its own), or null for a type no check stores.
 *
 * @example
 * contentKindOfMimeType("application/vnd.ms-excel"); // "xls"
 */
export function contentKindOfMimeType(mimeType: string): ContentKind | null {
  return contentKind.options.find((kind) => CONTENT_KINDS[kind].mimeType === mimeType) ?? null;
}
