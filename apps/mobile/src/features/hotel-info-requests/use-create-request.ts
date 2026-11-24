import { useEffect, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useCreateHotelInfoRequest, useHotelFormMode } from "@ampm/api-client";
import type {
  HotelFormMode,
  HotelInfoRequestCreateRequestInput,
  HotelInfoRequestLinkIssued,
} from "@ampm/core";
import { useToast } from "@ampm/ui";

import { hasErrors } from "../hotels-admin/hotel-form-fields";
import { requestErrors, type RequestDraft, type RequestErrors } from "./info-request.form";
import { refusalOf, type RequestRefusal } from "./info-request.refusal";

/** A create sheet's state, as its form, its footer and its link view read it. */
export interface CreateRequestSheet<D extends RequestDraft> {
  readonly draft: D;
  readonly patch: (next: Partial<D>) => void;
  /** The contract's checks after a blocked create, over the API's details of a refusal. */
  readonly errors: RequestErrors;
  /** The API's refusal of the last create: its message is shown in the sheet. */
  readonly refusal: RequestRefusal | null;
  /** The hotel form's mode, read afresh while the sheet is open. */
  readonly mode: UseQueryResult<HotelFormMode>;
  readonly submit: () => void;
  readonly pending: boolean;
  /** The create answer, which holds the link once; null until created and after close. */
  readonly issued: HotelInfoRequestLinkIssued | null;
  /** Closes the sheet and forgets the answer, link and all. */
  readonly close: () => void;
}

/** The draft, its checks' visibility and the last refusal, all fresh each time the sheet opens. */
function useFreshDraft<D extends RequestDraft>(open: boolean, empty: D, reset: () => void) {
  const [draft, setDraft] = useState<D>(empty);
  const [showErrors, setShowErrors] = useState(false);
  const [refusal, setRefusal] = useState<RequestRefusal | null>(null);
  useEffect(() => {
    if (!open) return;
    setDraft(empty);
    setShowErrors(false);
    setRefusal(null);
    reset();
  }, [open, empty, reset]);
  const patch = (next: Partial<D>): void => setDraft((previous) => ({ ...previous, ...next }));
  return { draft, patch, showErrors, setShowErrors, refusal, setRefusal };
}

/**
 * A create sheet's state (D-188 §7), shared by Send request and Invite a new hotel: the draft, fresh each
 * time the sheet opens; the contract's checks, shown after a blocked create; the API's refusal (its
 * message, and its details under their fields); the hotel form's mode, read afresh while the sheet is
 * open; and the answer, which holds the link once. Closing forgets the answer, link and all.
 *
 *   const sheet = useCreateRequest(open, EMPTY_REQUEST_DRAFT, (draft) => existingHotelBody(id, draft), onClose);
 *   sheet.issued?.link.url; // shown once
 */
export function useCreateRequest<D extends RequestDraft>(
  open: boolean,
  empty: D,
  bodyOf: (draft: D) => HotelInfoRequestCreateRequestInput,
  onClose: () => void,
): CreateRequestSheet<D> {
  const toast = useToast();
  const create = useCreateHotelInfoRequest();
  const mode = useHotelFormMode({ enabled: open });
  const { reset } = create;
  const form = useFreshDraft(open, empty, reset);
  const body = bodyOf(form.draft);
  const submit = (): void => {
    if (create.isPending) return;
    if (hasErrors(requestErrors(body))) return form.setShowErrors(true);
    form.setRefusal(null);
    create.mutate(body, {
      onError: (error) => {
        const refused = refusalOf(error, "Could not create the request");
        form.setRefusal(refused);
        toast.show({ title: refused.message, tone: "danger" });
      },
    });
  };
  return {
    draft: form.draft,
    patch: form.patch,
    errors: { ...form.refusal?.fields, ...(form.showErrors ? requestErrors(body) : {}) },
    refusal: form.refusal,
    mode,
    submit,
    pending: create.isPending,
    issued: create.data ?? null,
    close: () => {
      reset();
      onClose();
    },
  };
}
