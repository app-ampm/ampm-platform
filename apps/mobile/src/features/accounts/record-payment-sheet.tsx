import { useEffect, useState } from "react";

import { useRecordPayment } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, FilterChip, Input, Row, Sheet, Stack, Text, useToast } from "@ampm/ui";

import { PAYMENT_METHODS, paymentMethodLabel, type ManualPaymentMethod } from "./accounts.format";
import {
  buildPaymentBody,
  emptyPaymentDraft,
  hasPaymentErrors,
  validatePayment,
  type PaymentDraft,
  type PaymentErrors,
} from "./accounts.form";

const NO_ERRORS: PaymentErrors = { reference: undefined, paidAt: undefined };

/** The record-payment form's state, validation and submission (activates the subscription). */
function useRecordPaymentForm(subscriptionId: string, open: boolean, onClose: () => void) {
  const toast = useToast();
  const record = useRecordPayment();
  const [draft, setDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(emptyPaymentDraft());
      setShowErrors(false);
    }
  }, [open]);
  const patch = (next: Partial<PaymentDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (record.isPending) return;
    if (hasPaymentErrors(validatePayment(draft))) return setShowErrors(true);
    record.mutate(
      { subscriptionId, body: buildPaymentBody(draft) },
      {
        onSuccess: () => {
          toast.show({ title: "Payment recorded", tone: "success" });
          onClose();
        },
        onError: (error) =>
          toast.show({
            title: isAppError(error) ? error.message : "Could not record the payment",
            tone: "danger",
          }),
      },
    );
  };
  return {
    draft,
    patch,
    errors: showErrors ? validatePayment(draft) : NO_ERRORS,
    pending: record.isPending,
    submit,
  };
}

/** The manual payment method as wrapping chips; the chosen one carries a check, never colour alone. */
function MethodPicker({
  value,
  onChange,
}: {
  readonly value: ManualPaymentMethod;
  readonly onChange: (method: ManualPaymentMethod) => void;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" tone="body">
        Method
      </Text>
      <Row gap={2} wrap testID="payment-method">
        {PAYMENT_METHODS.map((method) => (
          <FilterChip
            key={method}
            label={paymentMethodLabel(method)}
            selected={method === value}
            icon={method === value ? "check" : undefined}
            onPress={() => onChange(method)}
          />
        ))}
      </Row>
    </Stack>
  );
}

export interface RecordPaymentSheetProps {
  /** The pending subscription to record a payment for, or null when the sheet is closed. */
  readonly subscriptionId: string | null;
  readonly onClose: () => void;
}

/**
 * Record a manual bank transfer against a pending subscription (`crm.subscriptions.update`). The amount
 * is NOT entered — the server takes it from the plan — so the recorder supplies the reference, the method
 * and, if it differs from now, when it was received. Recording it runs the same activation as the gateway
 * webhook.
 */
export function RecordPaymentSheet({ subscriptionId, onClose }: RecordPaymentSheetProps) {
  const { draft, patch, errors, pending, submit } = useRecordPaymentForm(
    subscriptionId ?? "",
    subscriptionId !== null,
    onClose,
  );
  return (
    <Sheet
      open={subscriptionId !== null}
      onClose={onClose}
      title="Record payment"
      testID="record-payment"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="record-payment-submit">
          Record payment
        </Button>
      }
    >
      <Stack gap={4}>
        <Text variant="body" tone="body">
          The amount is taken from the plan, so it always matches the price. Enter how the transfer
          was received.
        </Text>
        <Input
          label="Reference"
          required
          value={draft.reference}
          onChangeText={(reference) => patch({ reference })}
          placeholder="Bank reference / UTR"
          errorText={errors.reference}
          testID="payment-reference"
        />
        <MethodPicker value={draft.method} onChange={(method) => patch({ method })} />
        <Input
          label="Received on"
          value={draft.paidAt}
          onChangeText={(paidAt) => patch({ paidAt })}
          helpText="YYYY-MM-DD (optional; defaults to now)"
          errorText={errors.paidAt}
          testID="payment-paid-at"
        />
      </Stack>
    </Sheet>
  );
}
