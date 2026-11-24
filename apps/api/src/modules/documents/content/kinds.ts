import type { UploadRefusalReason } from "@ampm/core";

/*
 * The kinds of file the content checks recognise (D-187 §2), each with the type it is served as and the
 * extension a download is named with. A kind is decided by the bytes, never by the name or the declared
 * type: the families by their first bytes, Office packages by their main part, compound files by their
 * main stream.
 */

export type ContentKind =
  | "pdf"
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "mp4"
  | "pptx"
  | "ppsx"
  | "potx"
  | "ppt"
  | "xlsx"
  | "xltx"
  | "xls";

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

/** The Office kinds a package's main part can make it. */
export type OoxmlKind = Extract<ContentKind, "pptx" | "ppsx" | "potx" | "xlsx" | "xltx">;

/**
 * What the checks found: a kind, or the reason it is refused. `detail` names the exact rule for the logs;
 * the person who uploaded the file reads the reason's message (`UPLOAD_REFUSAL_MESSAGES`), never `detail`.
 */
export type InspectResult =
  | { readonly ok: true; readonly kind: ContentKind }
  | { readonly ok: false; readonly reason: UploadRefusalReason; readonly detail: string };

/**
 * The refusal for a Word file: "save it as a PDF" where the upload takes PDFs, otherwise the plain "not
 * a type this upload takes" (a Word file sent to the photo library cannot be fixed by saving a PDF).
 */
export function wordRefusal(accepted: ReadonlySet<ContentKind>): UploadRefusalReason {
  return accepted.has("pdf") ? "word_document" : "type_not_accepted";
}
