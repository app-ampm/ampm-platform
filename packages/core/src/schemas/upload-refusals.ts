import type { ErrorCode } from "../errors.js";

/*
 * Why an upload's content is refused (D-187 §2 and §3; docs/planning/hotel-information-form-plan.md §4.5
 * "Refused"). The API's content checks name one reason per refusal, and the reason picks the message a
 * hotel or a staff member reads and the error code the route answers with. Pure, so the apps can show the
 * same words for a refusal they read back from the API.
 */

/**
 * Every refusal reason, in the order the checks run: the type first, then the container, then what is
 * inside it.
 *
 * @example
 * const reason: UploadRefusalReason = UPLOAD_REFUSAL_REASONS[0]; // "unknown_type"
 */
export const UPLOAD_REFUSAL_REASONS = [
  /** Not a file type AMPM reads at all. */
  "unknown_type",
  /** A type AMPM reads, but not one this upload takes (a workbook for a floor plan). */
  "type_not_accepted",
  /** A Word document (.doc, .docx and their templates and macro kinds). */
  "word_document",
  /** A HEIF, HEIC or AVIF photo, which only some browsers and phones open. */
  "heif_image",
  /** Over the largest file the checks read. */
  "too_large",
  /** A file that is two types at once (a PDF that is also a ZIP, for example). */
  "polyglot",
  /** A file whose structure could not be read: truncated, inconsistent or looping. */
  "file_damaged",
  /** A ZIP package built in a way Office never writes: ZIP64, many entries, odd names or methods. */
  "archive_unsafe",
  /** A package that expands to far more data than it stores (a zip bomb). */
  "archive_expansion",
  /** A file that needs a password to open, or an encrypted Office file. */
  "password_protected",
  /** Macros: a macro-enabled kind, a VBA project or an Excel 4 macro sheet. */
  "macros",
  /** ActiveX, OLE objects, program actions, add-ins, custom ribbons and other embedded packages. */
  "active_content",
  /** External links, data connections, query tables, external targets and DDE formulas. */
  "external_content",
  /** A PDF with JavaScript, launch actions, embedded files, rich media or an XFA form. */
  "pdf_active_content",
  /** A PDF the checks cannot read: a stream that never ends, or one in a form they cannot decode. */
  "pdf_unreadable",
] as const;

export type UploadRefusalReason = (typeof UPLOAD_REFUSAL_REASONS)[number];

/**
 * What the person who uploaded the file reads, one short sentence they can act on (D-187 §3: the route
 * sends it as `details: [{ path: "file", message }]`).
 *
 * @example
 * throw new AppError("validation_failed", UPLOAD_REFUSAL_MESSAGES.macros, [
 *   { path: "file", message: UPLOAD_REFUSAL_MESSAGES.macros },
 * ]);
 */
export const UPLOAD_REFUSAL_MESSAGES: Readonly<Record<UploadRefusalReason, string>> = {
  unknown_type: "This type of file is not accepted. Upload one of the file types listed for it.",
  type_not_accepted:
    "This type of file is not accepted here. Upload one of the file types listed for it.",
  word_document: "Word files are not accepted: save it as a PDF and upload that.",
  heif_image:
    "HEIC, HEIF and AVIF photos are not accepted: save it as a JPEG or PNG and upload that.",
  too_large: "This file is too large to check: upload a smaller file.",
  polyglot:
    "This file reads as more than one type of file, which is not accepted: save it again from the program that made it and upload the new copy.",
  file_damaged:
    "This file could not be read and may be damaged: open it, save a new copy and upload that.",
  archive_unsafe:
    "This file is packed in a way that is not accepted: open it, save a new copy and upload that.",
  archive_expansion:
    "This file holds too much data to check: save it as a PDF, or split it into smaller files, and upload again.",
  password_protected:
    "This file is protected with a password: remove the password and upload it again.",
  macros:
    "Files with macros are not accepted: save a copy without macros (as .pptx, .xlsx or PDF) and upload that.",
  active_content:
    "This file contains embedded objects, add-ins or program actions, which are not accepted: remove them, or save it as a PDF, and upload that.",
  external_content:
    "This file links to outside data, templates or programs, which is not accepted: remove the links, or save it as a PDF, and upload that.",
  pdf_active_content:
    "This PDF contains scripts, attachments, forms or media, which are not accepted: save it as a plain PDF and upload that.",
  pdf_unreadable: "This PDF could not be checked: save it as a plain PDF and upload that.",
};

/** The reasons that mean "not a type this upload takes" rather than "refused inside a type it takes". */
const TYPE_REFUSALS: ReadonlySet<UploadRefusalReason> = new Set([
  "unknown_type",
  "type_not_accepted",
  "word_document",
  "heif_image",
]);

/**
 * The error code a refusal is answered with (D-187 §3): a type the upload does not take, Word included,
 * is 415 `unsupported_media_type`; anything refused inside a type it takes is 400 `validation_failed`.
 *
 * @example
 * uploadRefusalErrorCode("word_document"); // "unsupported_media_type"
 * uploadRefusalErrorCode("macros"); // "validation_failed"
 */
export function uploadRefusalErrorCode(
  reason: UploadRefusalReason,
): Extract<ErrorCode, "unsupported_media_type" | "validation_failed"> {
  return TYPE_REFUSALS.has(reason) ? "unsupported_media_type" : "validation_failed";
}
