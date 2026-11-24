import type { HotelDocumentUploadInput } from "@ampm/api-client";
import {
  documentTypeLabel,
  HOTEL_DOCUMENT_TITLE_MAX,
  isAppError,
  type HotelDocumentType,
  type HotelDocumentView,
} from "@ampm/core";
import type { PickedFile } from "@ampm/ui";

import { documentFileSizeError } from "./hotel-documents.format";

/*
 * The upload sheet's draft (D-187 §6): what a new document is, or the document a new version replaces;
 * its optional title (at most 120 characters; when blank, the type's name for a new document and the
 * current title for a new version) and the picked file; the checks before anything is sent, and the
 * upload it builds. No rendering, no I/O.
 */

export interface DocumentUploadDraft {
  /** What the document is: null until chosen for a new one; a new version keeps the replaced type. */
  readonly type: HotelDocumentType | null;
  readonly title: string;
  readonly file: PickedFile | null;
}

export type DocumentUploadErrors = {
  readonly type: string | undefined;
  readonly title: string | undefined;
  readonly file: string | undefined;
};

/** A fresh draft: nothing chosen for a new document; a new version keeps the type and the title. */
export function draftForUpload(replacing: HotelDocumentView | null): DocumentUploadDraft {
  return replacing
    ? { type: replacing.documentType, title: replacing.title, file: null }
    : { type: null, title: "", file: null };
}

/** Whether the picked file is over the chosen type's limit; nothing to say before both are chosen. */
export function fileSizeError(draft: DocumentUploadDraft): string | undefined {
  return draft.type && draft.file ? documentFileSizeError(draft.type, draft.file) : undefined;
}

/** The checks a save runs: a type, a title the contract takes, and a file within the type's limit. */
export function validateDocumentUpload(draft: DocumentUploadDraft): DocumentUploadErrors {
  return {
    type: draft.type ? undefined : "Choose what this document is",
    title:
      draft.title.trim().length > HOTEL_DOCUMENT_TITLE_MAX
        ? `Keep the title to ${HOTEL_DOCUMENT_TITLE_MAX} characters`
        : undefined,
    file: draft.file ? fileSizeError(draft) : "Choose the file to upload",
  };
}

/**
 * The upload a valid draft sends: the type, the title when one is given (trimmed; a blank one is left out
 * so the API names a new document after its type, and a new version keeps its document's title), the
 * document a new version replaces, and the file. Null while the draft lacks a type or a file.
 */
export function buildDocumentUpload(
  draft: DocumentUploadDraft,
  replacing: HotelDocumentView | null,
): HotelDocumentUploadInput | null {
  if (!draft.type || !draft.file) return null;
  const title = draft.title.trim();
  return {
    type: draft.type,
    ...(title ? { title } : {}),
    ...(replacing ? { replaces: replacing.id } : {}),
    file: draft.file.file,
  };
}

/**
 * The title field's hint: what a blank title becomes. The API keeps a new version's current title, and
 * names a new document after its type.
 */
export function titleHint(
  type: HotelDocumentType | null,
  replacing: HotelDocumentView | null,
): string {
  if (replacing) return `Optional. Left blank, it keeps its title “${replacing.title}”.`;
  return type
    ? `Optional. Left blank, it is called “${documentTypeLabel(type)}”.`
    : "Optional. Left blank, it takes the name of its type.";
}

/**
 * What the person reads when the API refuses an upload: the reason on the file when it names one (a
 * refused file, D-187 §3), else its message (a full library, a newer version filed since, a busy server,
 * a file over the cap).
 */
export function uploadRefusalMessage(error: unknown): string {
  if (!isAppError(error)) return "Could not upload the document. Try again.";
  return error.details?.find((detail) => detail.path === "file")?.message ?? error.message;
}

/**
 * Whether a refusal ends a new version's sheet rather than asking for another file: the document it
 * replaces is gone (404), or no longer takes this version (409: a newer one was filed since, or it
 * holds the most versions a document keeps).
 */
export function endsReplacement(error: unknown, replacing: HotelDocumentView | null): boolean {
  if (replacing === null || !isAppError(error)) return false;
  return error.code === "not_found" || error.code === "conflict";
}
