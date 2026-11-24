import { useEffect, useRef, useState, type RefObject } from "react";

import { useUploadHotelDocument } from "@ampm/api-client";
import type { HotelDocumentView } from "@ampm/core";
import { pickFile, useToast } from "@ampm/ui";

import {
  buildDocumentUpload,
  draftForUpload,
  endsReplacement,
  fileSizeError,
  uploadRefusalMessage,
  validateDocumentUpload,
  type DocumentUploadDraft,
  type DocumentUploadErrors,
} from "./document-upload.form";
import { hasErrors } from "./hotel-form-fields";
import { documentAccept, notUploadedMessage, uploadedMessage } from "./hotel-documents.format";

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
 * Whether this sheet is on screen now, for an answer that arrives later: false once it is closed, and
 * once it is gone (another opening replaced it, or the tab was left).
 */
function useShowing(open: boolean): RefObject<boolean> {
  const showing = useRef(open);
  useEffect(() => {
    showing.current = open;
    return () => {
      showing.current = false;
    };
  }, [open]);
  return showing;
}

interface OutcomeOptions {
  readonly replacing: HotelDocumentView | null;
  readonly showing: RefObject<boolean>;
  readonly onClose: () => void;
  readonly setRefusal: (refusal: string) => void;
}

/**
 * What an upload's answer does. A filed document is confirmed in a toast and closes the sheet if it is
 * still showing. A refusal shows under the file while the sheet is showing, except one that ends a new
 * version's sheet (its document gone or changed, 404 or 409), which closes it and says why in a toast,
 * the list refreshed by the upload hook; once the sheet has closed, a refusal is a toast naming the file.
 */
function useUploadOutcome({ replacing, showing, onClose, setRefusal }: OutcomeOptions) {
  const toast = useToast();
  const filed = (document: HotelDocumentView): void => {
    toast.show({ title: uploadedMessage(document, replacing !== null), tone: "success" });
    if (showing.current) onClose();
  };
  const refused = (error: unknown, fileName: string): void => {
    const message = uploadRefusalMessage(error);
    if (!showing.current) {
      toast.show({ title: notUploadedMessage(fileName), description: message, tone: "danger" });
    } else if (endsReplacement(error, replacing)) {
      onClose();
      toast.show({ title: message, tone: "danger" });
    } else {
      setRefusal(message);
    }
  };
  return { filed, refused };
}

export interface DocumentUploadFormOptions {
  readonly hotelId: string;
  /** The document a new version replaces, or null for a new document. */
  readonly replacing: HotelDocumentView | null;
  /** Whether the sheet is open: an answer that comes once it is not is reported in a toast. */
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * The upload sheet's form (D-187 §6): the draft, the file picker narrowed to the type's kinds, the size
 * check before anything is sent, and the upload. Its answer is read from the upload's own promise, which
 * settles whether or not the sheet is still mounted (React Query runs mutate()'s callbacks only while
 * the component that called it is), so an upload answered after the sheet has closed is still reported.
 * Mount it fresh for each opening (a `key`).
 *
 *   const form = useDocumentUploadForm({ hotelId, replacing, open, onClose });
 */
export function useDocumentUploadForm({
  hotelId,
  replacing,
  open,
  onClose,
}: DocumentUploadFormOptions) {
  const toast = useToast();
  const upload = useUploadHotelDocument(hotelId);
  const state = useUploadDraft(replacing);
  const showing = useShowing(open);
  const outcome = useUploadOutcome({ replacing, showing, onClose, setRefusal: state.setRefusal });
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
    const fileName = state.draft.file?.name ?? "The document";
    void upload
      .mutateAsync(input)
      .then(outcome.filed, (error: unknown) => outcome.refused(error, fileName));
  };
  const { draft, patch, errors, refusal } = state;
  return { draft, patch, errors, refusal, choose, submit, pending: upload.isPending };
}
