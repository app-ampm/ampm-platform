import { useEffect, useState } from "react";

import { useAddRateItem, useUpdateRateItem } from "@ampm/api-client";
import { isAppError, type RateItemView } from "@ampm/core";
import { Button, Input, Sheet, Stack, Toggle, useToast } from "@ampm/ui";

import { hasErrors } from "./hotel-form-fields";
import {
  RATE_ITEM_TYPES,
  RATE_UNITS,
  rateItemTypeLabel,
  rateUnitLabel,
} from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";
import {
  buildRateItemBody,
  draftFromRateItem,
  validateRateItem,
  type RateItemDraft,
  type RateItemErrors,
} from "./rate-cards.form";

const NO_ERRORS: RateItemErrors = {
  amount: undefined,
  amountMax: undefined,
  minQuantity: undefined,
};

type Patch = (next: Partial<RateItemDraft>) => void;

/** The rate-item create/edit form's state, validation and submission. */
function useRateItemForm(
  hotelId: string,
  cardId: string,
  open: boolean,
  item: RateItemView | null,
  onClose: () => void,
) {
  const toast = useToast();
  const create = useAddRateItem(hotelId);
  const update = useUpdateRateItem(hotelId);
  const [draft, setDraft] = useState<RateItemDraft>(() => draftFromRateItem(item));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFromRateItem(item));
      setShowErrors(false);
    }
  }, [open, item]);
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the rate item",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: item ? "Rate item updated" : "Rate item added", tone: "success" });
    onClose();
  };
  const patch: Patch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateRateItem(draft))) return setShowErrors(true);
    const body = buildRateItemBody(draft);
    if (!body) return setShowErrors(true);
    if (item) update.mutate({ cardId, itemId: item.id, body }, { onSuccess, onError });
    else create.mutate({ cardId, body }, { onSuccess, onError });
  };
  return {
    draft,
    patch,
    errors: showErrors ? validateRateItem(draft) : NO_ERRORS,
    pending,
    submit,
  };
}

/** The amount, optional upper bound, unit and minimum quantity of a rate item. */
function AmountFields({
  draft,
  patch,
  errors,
}: {
  readonly draft: RateItemDraft;
  readonly patch: Patch;
  readonly errors: RateItemErrors;
}) {
  return (
    <>
      <Input
        label="Amount (₹)"
        required
        value={draft.amount}
        onChangeText={(amount) => patch({ amount })}
        keyboardType="decimal-pad"
        helpText="In rupees, e.g. 25000"
        errorText={errors.amount}
        testID="rate-item-amount"
      />
      <Input
        label="Upper amount (₹)"
        value={draft.amountMax}
        onChangeText={(amountMax) => patch({ amountMax })}
        keyboardType="decimal-pad"
        helpText="For an indicative range (optional)"
        errorText={errors.amountMax}
        testID="rate-item-amount-max"
      />
      <MediaOptionPicker
        label="Unit"
        value={draft.unit}
        options={RATE_UNITS}
        optionLabel={rateUnitLabel}
        onChange={(unit) => patch({ unit })}
        testID="rate-item-unit"
      />
      <Input
        label="Minimum quantity"
        value={draft.minQuantity}
        onChangeText={(minQuantity) => patch({ minQuantity })}
        keyboardType="number-pad"
        errorText={errors.minQuantity}
        testID="rate-item-min-quantity"
      />
    </>
  );
}

export interface RateItemEditSheetProps {
  readonly hotelId: string;
  readonly cardId: string;
  readonly open: boolean;
  /** The rate item being edited, or null to add a new one. */
  readonly item: RateItemView | null;
  readonly onClose: () => void;
}

/** Add or edit a rate item (type, amount or range, unit, inclusions, whether clients see it). HT/SA only. */
export function RateItemEditSheet({
  hotelId,
  cardId,
  open,
  item,
  onClose,
}: RateItemEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useRateItemForm(
    hotelId,
    cardId,
    open,
    item,
    onClose,
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? "Edit rate item" : "New rate item"}
      size="full"
      testID="rate-item-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="rate-item-edit-submit">
          {item ? "Save changes" : "Add rate item"}
        </Button>
      }
    >
      <Stack gap={4}>
        <MediaOptionPicker
          label="Type"
          value={draft.itemType}
          options={RATE_ITEM_TYPES}
          optionLabel={rateItemTypeLabel}
          onChange={(itemType) => patch({ itemType })}
          testID="rate-item-type"
        />
        <AmountFields draft={draft} patch={patch} errors={errors} />
        <Toggle
          label="Indicative (a guide price, not a firm quote)"
          value={draft.isIndicative}
          onValueChange={(isIndicative) => patch({ isIndicative })}
          testID="rate-item-indicative"
        />
        <Input
          label="Inclusions"
          value={draft.inclusionsText}
          onChangeText={(inclusionsText) => patch({ inclusionsText })}
          multiline
          helpText="What the rate covers (optional)"
          testID="rate-item-inclusions"
        />
        <Toggle
          label="Shown to clients"
          value={draft.clientVisible}
          onValueChange={(clientVisible) => patch({ clientVisible })}
          testID="rate-item-client-visible"
        />
      </Stack>
    </Sheet>
  );
}
