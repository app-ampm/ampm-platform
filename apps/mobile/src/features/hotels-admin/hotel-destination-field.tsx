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

/** No destination exists yet: say so, and offer the way to add one to a role that may. */
function NoDestinations({ onAdd }: { readonly onAdd: (() => void) | undefined }) {
  return (
    <DestinationSlot>
      <Text variant="bodySmall" tone="muted">
        Add a destination before filing a hotel.
      </Text>
      {onAdd ? (
        <Button
          variant="secondary"
          size="sm"
          icon="map-pin"
          onPress={onAdd}
          testID="hotel-destination-add"
        >
          Go to Destinations
        </Button>
      ) : null}
    </DestinationSlot>
  );
}

export interface DestinationFieldProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly error: string | undefined;
  /** Shown when there is no destination yet: leaves the form for the Destinations screen. */
  readonly onAddDestination?: (() => void) | undefined;
}

/**
 * The destination picker over the staff destination list; mount it only while its sheet is open. Each of
 * the four states is distinct: a labelled skeleton, a retryable error, the empty guidance (with the way
 * to Destinations for a role that may add one), then the Select. destinationId is a required FK, so a
 * failed fetch must offer a retry rather than block create silently; the required-field error is owned
 * by the Select (announced like any other field's).
 */
export function DestinationField({
  value,
  onChange,
  error,
  onAddDestination,
}: DestinationFieldProps) {
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
  if (destinations.data.length === 0) return <NoDestinations onAdd={onAddDestination} />;
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
