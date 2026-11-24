import type { ContentKind, UploadRefusalReason } from "@ampm/core";

/*
 * What the content checks return (D-187 §2). The kinds themselves, with the type each is served as and
 * the extension a download is named with, are pure data in @ampm/core (`ContentKind`, `CONTENT_KINDS`),
 * shared with the apps. A kind is decided by the bytes, never by the name or the declared type: the
 * families by their first bytes, Office packages by their main part, compound files by their main stream.
 */

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
