import { useState } from "react";

import { useUpdateHotelInfoRequest } from "@ampm/api-client";
import type { HotelInfoRequestFullView } from "@ampm/core";
import { Button, Callout, Input, Sheet, Stack, useToast } from "@ampm/ui";

import {
  editBody,
  editDraftFrom,
  editErrors,
  type EditDraft,
  type RequestErrors,
} from "./info-request.form";
import { refusalOf } from "./info-request.refusal";

export interface EditRequestSheetProps {
  readonly open: boolean;
  readonly request: HotelInfoRequestFullView;
  readonly onClose: () => void;
}

/** The edit's state: the draft from the request each time the sheet opens, checks and the API's word. */
function useEditRequest(open: boolean, request: HotelInfoRequestFullView, onClose: () => void) {
  const toast = useToast();
  const update = useUpdateHotelInfoRequest();
  const [draft, setDraft] = useState<EditDraft>(() => editDraftFrom(request));
  const [errors, setErrors] = useState<RequestErrors>({});
  // Seeded each time the sheet opens, during that render (no effect): a refresh of the request while
  // the sheet is open keeps what was typed.
  const [seededOpen, setSeededOpen] = useState(open);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setDraft(editDraftFrom(request));
      setErrors({});
    }
  }
  const onSuccess = (): void => {
    toast.show({ title: "Request updated", tone: "success" });
    onClose();
  };
  const onError = (error: unknown): void => {
    const refused = refusalOf(error, "Could not save the request");
    setErrors({ ...refused.fields, form: refused.message });
    toast.show({ title: refused.message, tone: "danger" });
  };
  const submit = (): void => {
    if (update.isPending) return;
    const body = editBody(request, draft);
    const checks = editErrors(body);
    setErrors(checks);
    if (Object.keys(checks).length > 0) return;
    update.mutate({ requestId: request.id, body }, { onSuccess, onError });
  };
  const patch = (next: Partial<EditDraft>): void =>
    setDraft((previous) => ({ ...previous, ...next }));
  return { draft, patch, errors, submit, pending: update.isPending };
}

type EditFieldsProps = {
  readonly draft: EditDraft;
  readonly patch: (next: Partial<EditDraft>) => void;
  readonly errors: RequestErrors;
};

/** The recipient AMPM emails: a cleared field is removed. */
function EditRecipientFields({ draft, patch, errors }: EditFieldsProps) {
  return (
    <>
      <Input
        label="Recipient's name"
        value={draft.recipientName}
        onChangeText={(recipientName) => patch({ recipientName })}
        errorText={errors.recipientName}
        autoCapitalize="words"
        testID="edit-request-recipient-name"
      />
      <Input
        label="Recipient's email"
        value={draft.recipientEmail}
        onChangeText={(recipientEmail) => patch({ recipientEmail })}
        errorText={errors.recipientEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        testID="edit-request-recipient-email"
      />
    </>
  );
}

/** The label and note the hotel sees, the recipient AMPM emails, and the API's word on a refusal. */
function EditFields({ draft, patch, errors }: EditFieldsProps) {
  return (
    <Stack gap={4}>
      {errors.form ? (
        <Callout kind="danger" title={errors.form} blur={false} testID="edit-request-refusal" />
      ) : null}
      <Input
        label="Label"
        helpText="The hotel sees it, in the email and on the form."
        value={draft.displayLabel}
        onChangeText={(displayLabel) => patch({ displayLabel })}
        errorText={errors.displayLabel}
        testID="edit-request-label"
      />
      <Input
        label="Note to the hotel"
        helpText="The hotel sees it on the form's first page."
        value={draft.staffNote}
        onChangeText={(staffNote) => patch({ staffNote })}
        errorText={errors.staffNote}
        multiline
        testID="edit-request-note"
      />
      <EditRecipientFields draft={draft} patch={patch} errors={errors} />
    </Stack>
  );
}

/**
 * Edit a live request (D-188 §3 and §7): the label and the note, which the hotel sees, and the recipient
 * AMPM emails; a cleared field is removed. Only what changed is sent.
 *
 *   <EditRequestSheet open={action === "edit"} request={request} onClose={close} />
 */
export function EditRequestSheet({ open, request, onClose }: EditRequestSheetProps) {
  const { draft, patch, errors, submit, pending } = useEditRequest(open, request, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Edit ${request.reference}`}
      size="full"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="edit-request-submit">
          Save changes
        </Button>
      }
      testID="edit-request"
    >
      <EditFields draft={draft} patch={patch} errors={errors} />
    </Sheet>
  );
}
