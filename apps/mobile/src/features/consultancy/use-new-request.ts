import { useState } from "react";
import { useRouter } from "expo-router";

import { useRequestHotelAssistance } from "@ampm/api-client";
import { isAppError, type HotelAssistanceRequestResponse } from "@ampm/core";
import { useToast } from "@ampm/ui";

import {
  dateErrors,
  EMPTY_REQUEST_DRAFT,
  toCreateRequest,
  type DateErrors,
  type NewRequestDraft,
} from "./new-request.form";

export interface NewRequestForm {
  readonly draft: NewRequestDraft;
  readonly update: <K extends keyof NewRequestDraft>(key: K, value: NewRequestDraft[K]) => void;
  readonly errors: DateErrors;
  /** False until the dates and the party size make a valid request. */
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
  /** The request could not reach the server; the form keeps what was typed for another try. */
  readonly isOffline: boolean;
  /** The API's own message when it refused the request (an AppError), shown above the form. */
  readonly errorText: string | undefined;
  readonly submit: () => void;
}

/**
 * The CP-07 form's state and its one mutation. A subscriber's request opens an enquiry and the screen
 * moves on to it; a demo prospect's request is routed to Sales instead (P-7): a toast, then back.
 */
export function useNewRequest(hotelId: string): NewRequestForm {
  const router = useRouter();
  const toast = useToast();
  const request = useRequestHotelAssistance();
  const [draft, setDraft] = useState<NewRequestDraft>(EMPTY_REQUEST_DRAFT);
  const payload = toCreateRequest(hotelId, draft);

  const onSuccess = (result: HotelAssistanceRequestResponse): void => {
    if (result.kind === "enquiry") {
      router.replace(`/portal/requests/${result.enquiry.id}`);
      return;
    }
    toast.show({ title: "We've passed your request to our team", tone: "success" });
    router.back();
  };

  const submit = (): void => {
    if (!payload || request.isPending) return;
    request.mutate(payload, {
      onSuccess,
      onError: () => toast.show({ title: "Could not send your request", tone: "danger" }),
    });
  };

  const failure = request.isError && isAppError(request.error) ? request.error : null;
  const isOffline = failure?.code === "network_error";
  return {
    draft,
    update: (key, value) => setDraft((current) => ({ ...current, [key]: value })),
    errors: dateErrors(draft.dateFrom, draft.dateTo),
    canSubmit: payload !== null,
    isSubmitting: request.isPending,
    isOffline,
    errorText: failure && !isOffline ? failure.message : undefined,
    submit,
  };
}
