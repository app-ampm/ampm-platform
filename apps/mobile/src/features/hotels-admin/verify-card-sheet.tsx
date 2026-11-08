import { useEffect, useState } from "react";

import { useHotelVerifications, useRecordVerification, useVerifyRateCard } from "@ampm/api-client";
import { isAppError, type VerificationView } from "@ampm/core";
import { Button, Card, Input, Row, Sheet, Stack, Text, useToast } from "@ampm/ui";

import { VERIFICATION_SOURCES, verificationSourceLabel } from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";
import {
  buildVerificationBody,
  emptyVerificationDraft,
  type VerificationDraft,
} from "./rate-cards.form";

/** Record a verification then publish the card against it, or publish against an existing one. */
function useVerifyCard(hotelId: string, cardId: string, onClose: () => void) {
  const toast = useToast();
  const verifications = useHotelVerifications(hotelId);
  const record = useRecordVerification(hotelId);
  const verify = useVerifyRateCard(hotelId);
  // Remember a recorded verification so a failed verify retries against it, never recording a second one.
  const [recordedId, setRecordedId] = useState<string | null>(null);
  useEffect(() => setRecordedId(null), [cardId]);
  const pending = record.isPending || verify.isPending;
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not verify the rate card",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: "Rate card verified", tone: "success" });
    onClose();
  };
  const verifyWith = (verificationId: string): void => {
    if (pending) return;
    verify.mutate({ cardId, body: { verificationId } }, { onSuccess, onError });
  };
  const recordAndVerify = async (draft: VerificationDraft): Promise<void> => {
    if (pending) return;
    if (recordedId) return verifyWith(recordedId); // a prior retry already recorded; just verify again
    try {
      const recorded = await record.mutateAsync(buildVerificationBody(draft));
      setRecordedId(recorded.id);
      verify.mutate({ cardId, body: { verificationId: recorded.id } }, { onSuccess, onError });
    } catch (error) {
      onError(error);
    }
  };
  const rates = (verifications.data ?? []).filter((v) => v.fieldGroup === "rates");
  return { rates, pending, verifyWith, recordAndVerify };
}

/** Existing "rates" verifications the card can be published against, newest first by the API's order. */
function ExistingVerifications({
  rates,
  onPick,
  pending,
}: {
  readonly rates: readonly VerificationView[];
  readonly onPick: (id: string) => void;
  readonly pending: boolean;
}) {
  if (rates.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text variant="label">Use a recorded verification</Text>
      <Card padding="sm">
        <Stack gap={3}>
          {rates.map((v) => (
            <Row key={v.id} gap={3} align="center" justify="between">
              <Text variant="bodySmall" tone="muted" numberOfLines={1} className="flex-1">
                {v.source ? verificationSourceLabel(v.source) : "Verification"}
                {v.verifiedAt ? ` · ${v.verifiedAt.slice(0, 10)}` : ""}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onPress={() => onPick(v.id)}
                testID={`verify-use-${v.id}`}
              >
                Verify
              </Button>
            </Row>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

export interface VerifyCardSheetProps {
  readonly hotelId: string;
  /** The card to verify, or null when the sheet is closed. */
  readonly cardId: string | null;
  readonly onClose: () => void;
}

/**
 * Publish a rate card: record how its rates were verified (phone, site visit, …) and verify the card, or
 * reuse a recorded verification. Once verified, the card's client-visible items show in client discovery.
 */
export function VerifyCardSheet({ hotelId, cardId, onClose }: VerifyCardSheetProps) {
  const [draft, setDraft] = useState<VerificationDraft>(emptyVerificationDraft);
  useEffect(() => {
    if (cardId) setDraft(emptyVerificationDraft());
  }, [cardId]);
  const { rates, pending, verifyWith, recordAndVerify } = useVerifyCard(
    hotelId,
    cardId ?? "",
    onClose,
  );
  return (
    <Sheet
      open={cardId !== null}
      onClose={onClose}
      title="Verify rate card"
      testID="verify-card"
      footer={
        <Button
          fullWidth
          loading={pending}
          onPress={() => void recordAndVerify(draft)}
          testID="verify-card-submit"
        >
          Record verification & verify
        </Button>
      }
    >
      <Stack gap={4}>
        <Text variant="body" tone="body">
          Verifying publishes this card&apos;s client-visible items to client discovery.
        </Text>
        <ExistingVerifications rates={rates} onPick={verifyWith} pending={pending} />
        <MediaOptionPicker
          label="How were the rates verified?"
          value={draft.source}
          options={VERIFICATION_SOURCES}
          optionLabel={verificationSourceLabel}
          onChange={(source) => setDraft((prev) => ({ ...prev, source }))}
          testID="verify-source"
        />
        <Input
          label="Notes"
          value={draft.notes}
          onChangeText={(notes) => setDraft((prev) => ({ ...prev, notes }))}
          multiline
          helpText="Optional; kept with the verification record"
          testID="verify-notes"
        />
      </Stack>
    </Sheet>
  );
}
