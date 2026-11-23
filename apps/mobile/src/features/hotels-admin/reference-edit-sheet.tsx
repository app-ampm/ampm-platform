import { useEffect, useState } from "react";

import { useCreateHotelReference, useUpdateHotelReference } from "@ampm/api-client";
import { isAppError, type WeddingReferenceView } from "@ampm/core";
import { Button, Input, Sheet, Stack, Text, useToast } from "@ampm/ui";

import { hasErrors } from "./hotel-form-fields";
import {
  buildReferenceBody,
  draftFromReference,
  validateReference,
  type ReferenceDraft,
  type ReferenceErrors,
} from "./references.form";

const NO_ERRORS: ReferenceErrors = {
  eventYear: undefined,
  guestCount: undefined,
  descriptionClient: undefined,
};

/** Saving the draft: create or update, a toast either way, and closing on success. */
function useReferenceSave(
  hotelId: string,
  reference: WeddingReferenceView | null,
  onClose: () => void,
) {
  const toast = useToast();
  const create = useCreateHotelReference(hotelId);
  const update = useUpdateHotelReference(hotelId);
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the reference",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: reference ? "Reference updated" : "Reference added", tone: "success" });
    onClose();
  };
  const save = (draft: ReferenceDraft): void => {
    const body = buildReferenceBody(draft);
    if (reference) update.mutate({ referenceId: reference.id, body }, { onSuccess, onError });
    else create.mutate({ ...body, clientVisible: false }, { onSuccess, onError });
  };
  return { save, pending: create.isPending || update.isPending };
}

/** The reference create/edit form's state and validation; a fresh draft each time the sheet opens. */
function useReferenceForm(
  hotelId: string,
  open: boolean,
  reference: WeddingReferenceView | null,
  onClose: () => void,
) {
  const { save, pending } = useReferenceSave(hotelId, reference, onClose);
  const [draft, setDraft] = useState<ReferenceDraft>(() => draftFromReference(reference));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFromReference(reference));
      setShowErrors(false);
    }
  }, [open, reference]);
  const patch: Patch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateReference(draft))) return setShowErrors(true);
    save(draft);
  };
  const errors = showErrors ? validateReference(draft) : NO_ERRORS;
  return { draft, patch, errors, pending, submit };
}

type Patch = (next: Partial<ReferenceDraft>) => void;

interface FieldsProps {
  readonly draft: ReferenceDraft;
  readonly patch: Patch;
  readonly errors: ReferenceErrors;
}

/** The wedding's year and how many guests it had. */
function ReferenceCountFields({ draft, patch, errors }: FieldsProps) {
  return (
    <>
      <Input
        label="Year of the wedding"
        required
        value={draft.eventYear}
        onChangeText={(eventYear) => patch({ eventYear })}
        keyboardType="number-pad"
        errorText={errors.eventYear}
        placeholder="e.g. 2024"
        testID="reference-year"
      />
      <Input
        label="Guests"
        value={draft.guestCount}
        onChangeText={(guestCount) => patch({ guestCount })}
        keyboardType="number-pad"
        errorText={errors.guestCount}
        testID="reference-guests"
      />
    </>
  );
}

/** The fields, then (for a new reference) that it starts internal. */
function ReferenceFields({ isNew, ...props }: FieldsProps & { readonly isNew: boolean }) {
  return (
    <Stack gap={4}>
      <ReferenceCountFields {...props} />
      <Input
        label="What clients read"
        helpText="Shown on the hotel page once the couple's consent is on file and you show it"
        value={props.draft.descriptionClient}
        onChangeText={(descriptionClient) => props.patch({ descriptionClient })}
        errorText={props.errors.descriptionClient}
        multiline
        placeholder="e.g. A three-day lakeside celebration for 320 guests"
        testID="reference-description"
      />
      {isNew ? (
        <Text variant="bodySmall" tone="muted">
          The reference starts internal. Attach the couple's consent on its row to show it to
          clients.
        </Text>
      ) : null}
    </Stack>
  );
}

export interface ReferenceEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The reference being edited, or null to add a new one. */
  readonly reference: WeddingReferenceView | null;
  readonly onClose: () => void;
}

/**
 * Add or edit a previous wedding at the hotel: its year, guests and the description clients read. A new
 * reference starts internal; consent and showing it to clients happen on its row (GP-20). HT / SA only.
 */
export function ReferenceEditSheet({ hotelId, open, reference, onClose }: ReferenceEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useReferenceForm(
    hotelId,
    open,
    reference,
    onClose,
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={reference ? "Edit reference" : "New reference"}
      size="full"
      testID="reference-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="reference-edit-submit">
          {reference ? "Save changes" : "Add reference"}
        </Button>
      }
    >
      <ReferenceFields draft={draft} patch={patch} errors={errors} isNew={reference === null} />
    </Sheet>
  );
}
