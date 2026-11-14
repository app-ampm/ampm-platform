import type { UseQueryResult } from "@tanstack/react-query";

import { useHotelVerifications } from "@ampm/api-client";
import { formatDay, type VerificationView } from "@ampm/core";
import { Card, SectionError, Skeleton, Stack, StatusChip, Text } from "@ampm/ui";

import { latestVerification, verificationSourceLabel } from "./hotels-admin.format";

/** The newest rates verification: when, how, and when it falls due again. */
function VerificationFacts({ verifications }: { readonly verifications: VerificationView[] }) {
  const latest = latestVerification(verifications, "rates");
  if (!latest) {
    return (
      <Stack gap={2}>
        {/* The panel's section name ("Verification") is its heading; this line is its finding. */}
        <Text variant="heading" accessibilityRole="text">
          Rates not verified yet
        </Text>
        <Text variant="bodySmall" tone="muted">
          Verify a rate card to publish its client-visible rates.
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap={2}>
      <Text variant="heading" accessibilityRole="text">
        {`Verified on ${formatDay(latest.verifiedAt)}`}
      </Text>
      {latest.status === "stale" ? <StatusChip label="Stale" tone="warning" size="sm" /> : null}
      {latest.source ? (
        <Text variant="bodySmall" tone="body">
          {`Source: ${verificationSourceLabel(latest.source)}`}
        </Text>
      ) : null}
      {latest.nextDueAt ? (
        <Text variant="bodySmall" tone="muted">
          {`Due for checking again on ${formatDay(latest.nextDueAt)}.`}
        </Text>
      ) : null}
    </Stack>
  );
}

function VerificationBody({
  verifications,
}: {
  readonly verifications: UseQueryResult<VerificationView[]>;
}) {
  if (verifications.isPending) return <Skeleton className="h-16 w-full" />;
  if (verifications.isError) {
    return (
      <SectionError
        title="Verification"
        error={verifications.error}
        onRetry={() => void verifications.refetch()}
      />
    );
  }
  return <VerificationFacts verifications={verifications.data} />;
}

/**
 * T5's verification panel beside the rate cards: when the hotel's rates were last verified, from which
 * source, and when they fall due. Verifying stays on each card, because a card publishes against its own
 * verification record; the record names its verifier only by id, so the panel does not say who.
 */
export function RatesVerificationPanel({ hotelId }: { readonly hotelId: string }) {
  const verifications = useHotelVerifications(hotelId);
  return (
    <Card testID="rates-verification">
      <Stack gap={3}>
        <Text variant="eyebrow" tone="muted" accessibilityRole="header">
          Verification
        </Text>
        <VerificationBody verifications={verifications} />
      </Stack>
    </Card>
  );
}
