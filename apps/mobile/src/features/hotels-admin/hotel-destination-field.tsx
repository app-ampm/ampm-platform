import type { ReactNode } from "react";

import { useStaffDestinations } from "@ampm/api-client";
import { Button, Select, Skeleton, Stack, Text } from "@ampm/ui";

import { destinationOption } from "./hotels-admin.format";

/** A labelled slot for the destination field's loading / error / empty states (before the select shows). */
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

export interface DestinationFieldProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly error: string | undefined;
}

/**
 * The destination picker over the staff destination list; mount it only while its sheet is open. Each of
 * the four states is distinct: a labelled skeleton, a retryable error, the empty guidance, then the
 * Select. destinationId is a required FK, so a failed fetch must offer a retry rather than block create
 * silently; the required-field error is owned by the Select (announced like any other field's).
 */
export function DestinationField({ value, onChange, error }: DestinationFieldProps) {
  const destinations = useStaffDestinations();
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
    <Select
      label="Destination"
      value={value || null}
      options={destinations.data.map((item) => ({
        value: item.id,
        label: destinationOption(item),
      }))}
      onChange={onChange}
      placeholder="Choose a destination"
      sheetTitle="Choose a destination"
      searchable={destinations.data.length > 8}
      required
      errorText={error}
      testID="hotel-destination"
    />
  );
}
