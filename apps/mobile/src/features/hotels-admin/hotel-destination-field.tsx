import type { ReactNode } from "react";

import { useStaffDestinations } from "@ampm/api-client";
import type { DestinationView } from "@ampm/core";
import { Button, Skeleton, Stack, Text, useAnnounce } from "@ampm/ui";

import { destinationOption } from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";

/** A labelled slot for the destination field's loading / error / empty states (before the picker shows). */
function DestinationSlot({ children }: { readonly children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="muted">
        Destination
      </Text>
      {children}
    </Stack>
  );
}

/** The destinations fetch failed: a clear message and a retry (so create is never a silent dead-end). */
function DestinationFetchError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <DestinationSlot>
      <Text
        variant="bodySmall"
        tone="brand"
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        Couldn&apos;t load destinations.
      </Text>
      <Button variant="secondary" size="sm" onPress={onRetry} testID="hotel-destination-retry">
        Retry
      </Button>
    </DestinationSlot>
  );
}

/** The loaded picker, with the required-field error announced like a shared Input's. */
function DestinationChoices({
  value,
  onChange,
  error,
  items,
}: {
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly error: string | undefined;
  readonly items: readonly DestinationView[];
}) {
  const labelOf = new Map(items.map((item) => [item.id, destinationOption(item)]));
  return (
    <Stack gap={1}>
      <MediaOptionPicker
        label="Destination"
        value={value}
        options={items.map((item) => item.id)}
        optionLabel={(id) => labelOf.get(id) ?? id}
        onChange={onChange}
        testID="hotel-destination"
      />
      {error ? (
        <Text
          variant="bodySmall"
          tone="brand"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

export interface DestinationFieldProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly error: string | undefined;
}

/**
 * The destination picker over the staff destination list; mount it only while its sheet is open. Each of
 * the four states is distinct: a labelled skeleton, a retryable error, the empty guidance, then the picker.
 * destinationId is a required FK, so a failed fetch must offer a retry rather than block create silently.
 */
export function DestinationField({ value, onChange, error }: DestinationFieldProps) {
  const destinations = useStaffDestinations();
  useAnnounce(error, Boolean(error));
  if (destinations.isPending) {
    return (
      <DestinationSlot>
        <Skeleton className="h-10 w-full" />
      </DestinationSlot>
    );
  }
  if (destinations.isError) {
    return <DestinationFetchError onRetry={() => void destinations.refetch()} />;
  }
  if (destinations.data.length === 0) {
    return (
      <DestinationSlot>
        <Text variant="bodySmall" tone="muted">
          Add a destination before filing a hotel.
        </Text>
      </DestinationSlot>
    );
  }
  return (
    <DestinationChoices value={value} onChange={onChange} error={error} items={destinations.data} />
  );
}
