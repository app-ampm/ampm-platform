import { useEffect, useState } from "react";

import { useCreateRateCard, useUpdateRateCard } from "@ampm/api-client";
import { isAppError, type RateCardView } from "@ampm/core";
import { Button, InternalPanel, Input, Sheet, Stack, useToast } from "@ampm/ui";

import { hasErrors } from "./hotel-form-fields";
import {
  buildRateCardBody,
  openingRateCardDraft,
  validateRateCard,
  type RateCardDraft,
  type RateCardErrors,
} from "./rate-cards.form";

const NO_ERRORS: RateCardErrors = { name: undefined, validFrom: undefined, validTo: undefined };

/** Saving the draft: create or update, a toast either way, the created card handed on, then closing. */
function useRateCardSave({ hotelId, card, onClose, onCreated }: RateCardEditSheetProps) {
  const toast = useToast();
  const create = useCreateRateCard(hotelId);
  const update = useUpdateRateCard(hotelId);
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the rate card",
      tone: "danger",
    });
  const onSuccess = (saved: RateCardView): void => {
    toast.show({ title: card ? "Rate card updated" : "Rate card added", tone: "success" });
    if (!card) onCreated?.(saved);
    onClose();
  };
  const save = (draft: RateCardDraft): void => {
    const body = buildRateCardBody(draft);
    if (card) update.mutate({ cardId: card.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };
  return { save, pending: create.isPending || update.isPending };
}

/** The rate-card create/edit form's state and validation; a fresh draft each time the sheet opens. */
function useRateCardForm(props: RateCardEditSheetProps) {
  const { open, card, prefill } = props;
  const { save, pending } = useRateCardSave(props);
  const [draft, setDraft] = useState<RateCardDraft>(() => openingRateCardDraft(card, prefill));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(openingRateCardDraft(card, prefill));
      setShowErrors(false);
    }
  }, [open, card, prefill]);
  const patch = (next: Partial<RateCardDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateRateCard(draft))) return setShowErrors(true);
    save(draft);
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
  /**
   * What a new card opens with (a menu's draft F&B card: its name and restricted source). Keep it the
   * same object while the sheet is open: a new one starts the draft again.
   */
  readonly prefill?: Partial<RateCardDraft> | undefined;
  readonly onClose: () => void;
  /** Called with a new card once it is created (never after an edit), before the sheet closes. */
  readonly onCreated?: ((card: RateCardView) => void) | undefined;
}

/**
 * Add or edit a rate card (name, validity dates, and the staff-only source and notes). A new card starts
 * as a draft — nothing reaches clients until it is verified — and may open prefilled, as a menu's draft
 * F&B card does (D-187 §6). Hotel team / Super Admin only, gated server-side.
 */
export function RateCardEditSheet(props: RateCardEditSheetProps) {
  const { open, card, onClose } = props;
  const { draft, patch, errors, pending, submit } = useRateCardForm(props);
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
