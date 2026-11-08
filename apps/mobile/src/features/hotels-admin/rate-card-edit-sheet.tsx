import { useEffect, useState } from "react";

import { useCreateRateCard, useUpdateRateCard } from "@ampm/api-client";
import { isAppError, type RateCardView } from "@ampm/core";
import { Button, InternalPanel, Input, Sheet, Stack, useToast } from "@ampm/ui";

import { hasErrors } from "./hotel-form-fields";
import {
  buildRateCardBody,
  draftFromRateCard,
  validateRateCard,
  type RateCardDraft,
  type RateCardErrors,
} from "./rate-cards.form";

const NO_ERRORS: RateCardErrors = { name: undefined, validFrom: undefined, validTo: undefined };

/** The rate-card create/edit form's state, validation and submission. */
function useRateCardForm(
  hotelId: string,
  open: boolean,
  card: RateCardView | null,
  onClose: () => void,
) {
  const toast = useToast();
  const create = useCreateRateCard(hotelId);
  const update = useUpdateRateCard(hotelId);
  const [draft, setDraft] = useState<RateCardDraft>(() => draftFromRateCard(card));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFromRateCard(card));
      setShowErrors(false);
    }
  }, [open, card]);
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the rate card",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: card ? "Rate card updated" : "Rate card added", tone: "success" });
    onClose();
  };
  const patch = (next: Partial<RateCardDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateRateCard(draft))) return setShowErrors(true);
    const body = buildRateCardBody(draft);
    if (card) update.mutate({ cardId: card.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };
  return {
    draft,
    patch,
    errors: showErrors ? validateRateCard(draft) : NO_ERRORS,
    pending,
    submit,
  };
}

export interface RateCardEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The rate card being edited, or null to add a new one. */
  readonly card: RateCardView | null;
  readonly onClose: () => void;
}

/**
 * Add or edit a rate card (name, validity dates, and the staff-only source and notes). A new card starts
 * as a draft — nothing reaches clients until it is verified. Hotel team / Super Admin only, gated server-side.
 */
export function RateCardEditSheet({ hotelId, open, card, onClose }: RateCardEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useRateCardForm(hotelId, open, card, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={card ? "Edit rate card" : "New rate card"}
      size="full"
      testID="rate-card-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="rate-card-edit-submit">
          {card ? "Save changes" : "Add rate card"}
        </Button>
      }
    >
      <Stack gap={4}>
        <Input
          label="Name"
          required
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          errorText={errors.name}
          placeholder="e.g. Wedding season 2027"
          testID="rate-card-name"
        />
        <Input
          label="Valid from"
          value={draft.validFrom}
          onChangeText={(validFrom) => patch({ validFrom })}
          helpText="YYYY-MM-DD (optional)"
          errorText={errors.validFrom}
          testID="rate-card-valid-from"
        />
        <Input
          label="Valid to"
          value={draft.validTo}
          onChangeText={(validTo) => patch({ validTo })}
          helpText="YYYY-MM-DD (optional)"
          errorText={errors.validTo}
          testID="rate-card-valid-to"
        />
        <InternalPanel>
          <Stack gap={4}>
            <Input
              label="Source"
              value={draft.source}
              onChangeText={(source) => patch({ source })}
              placeholder="Where these rates came from"
              testID="rate-card-source"
            />
            <Input
              label="Internal notes"
              value={draft.internalNotes}
              onChangeText={(internalNotes) => patch({ internalNotes })}
              multiline
              testID="rate-card-internal-notes"
            />
          </Stack>
        </InternalPanel>
      </Stack>
    </Sheet>
  );
}
