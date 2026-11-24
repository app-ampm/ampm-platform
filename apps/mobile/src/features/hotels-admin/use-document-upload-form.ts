import { useState } from "react";

import { useUploadHotelDocument } from "@ampm/api-client";
import { isAppError, type HotelDocumentView } from "@ampm/core";
import { pickFile, useToast } from "@ampm/ui";

import {
  buildDocumentUpload,
  draftForUpload,
  fileSizeError,
  validateDocumentUpload,
  type DocumentUploadDraft,
  type DocumentUploadErrors,
} from "./document-upload.form";
import { hasErrors } from "./hotel-form-fields";
import { documentAccept, uploadedMessage } from "./hotel-documents.format";

/**
 * What the person reads when the API refuses an upload: its message, the one on the file when it names
 * one (a refused file's reason, D-187 §3), or its own for a full library, a newer version filed since,
 * a busy server or a file over the cap.
 */
function refusalMessage(error: unknown): string {
  if (!isAppError(error)) return "Could not upload the document. Try again.";
  return error.details?.find((detail) => detail.path === "file")?.message ?? error.message;
}

/** The draft's state: a change clears the API's last answer, which was about the draft as it was. */
function useUploadDraft(replacing: HotelDocumentView | null) {
  const [draft, setDraft] = useState<DocumentUploadDraft>(() => draftForUpload(replacing));
  const [showErrors, setShowErrors] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const patch = (next: Partial<DocumentUploadDraft>): void => {
    setDraft((previous) => ({ ...previous, ...next }));
    setRefusal(null);
  };
  // The size is a fact about the picked file, so it shows as soon as both the file and the type are known.
  const errors: DocumentUploadErrors = showErrors
    ? validateDocumentUpload(draft)
    : { type: undefined, title: undefined, file: fileSizeError(draft) };
  return { draft, patch, errors, refusal, setRefusal, setShowErrors };
}

/**
 * The upload sheet's form (D-187 §6): the draft, the file picker narrowed to the type's kinds, the size
 * check before anything is sent, and the upload, closing on success and keeping the sheet open with the
 * API's message on a refusal, a busy server or a 409. Mount it fresh for each opening (a `key`).
 *
 *   const form = useDocumentUploadForm(hotelId, replacing, onClose);
 */
export function useDocumentUploadForm(
  hotelId: string,
  replacing: HotelDocumentView | null,
  onClose: () => void,
) {
  const toast = useToast();
  const upload = useUploadHotelDocument(hotelId);
  const state = useUploadDraft(replacing);
  const choose = async (): Promise<void> => {
    const picked = await pickFile(documentAccept(state.draft.type));
    if (!picked) {
      toast.show({ title: "Upload documents from the web workspace", tone: "info" });
      return;
    }
    state.patch({ file: picked });
  };
  const submit = (): void => {
    const input = buildDocumentUpload(state.draft, replacing);
    if (upload.isPending) return;
    if (!input || hasErrors(validateDocumentUpload(state.draft))) return state.setShowErrors(true);
    state.setRefusal(null);
    upload.mutate(input, {
      onSuccess: (filed) => {
        toast.show({ title: uploadedMessage(filed, replacing !== null), tone: "success" });
        onClose();
      },
      onError: (error) => state.setRefusal(refusalMessage(error)),
    });
  };
  const { draft, patch, errors, refusal } = state;
  return { draft, patch, errors, refusal, choose, submit, pending: upload.isPending };
}
