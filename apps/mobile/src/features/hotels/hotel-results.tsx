import type { useHotels } from "@ampm/api-client";
import { EmptyState, Skeleton, Stack, Text } from "@ampm/ui";

import { HotelCard } from "./hotel-card";
import { DISCOVERY_CLOSED, hotelCountLabel } from "./hotels.format";
import { HotelsQueryError } from "./hotels-query-error";

export interface HotelResultsProps {
  readonly hotels: ReturnType<typeof useHotels>;
  readonly onOpen: (hotelId: string) => void;
}

/**
 * The results in every state: loading, offline, signed out, refused (the server's 404 when the account
 * no longer holds hotel discovery), failed, nothing found, or the cards.
 */
export function HotelResults({ hotels, onOpen }: HotelResultsProps) {
  if (hotels.isPending) return <HotelResultsLoading />;
  if (hotels.isError)
    return (
      <HotelsQueryError
        error={hotels.error}
        onRetry={() => void hotels.refetch()}
        signInTitle="Sign in to browse hotels"
        notFound={DISCOVERY_CLOSED}
      />
    );
  const { items, nextCursor } = hotels.data;
  if (items.length === 0)
    return (
      <EmptyState icon="inbox" title="No hotels found" description="Try a different search." />
    );
  return (
    <Stack gap={3}>
      <Text variant="eyebrow">{hotelCountLabel(items.length, nextCursor !== null)}</Text>
      {items.map((hotel) => (
        <HotelCard key={hotel.id} hotel={hotel} onPress={() => onOpen(hotel.id)} />
      ))}
    </Stack>
  );
}

/** Three cards' worth of skeleton, the size of a result card, so nothing jumps when they arrive. */
export function HotelResultsLoading() {
  return (
    <Stack gap={3} testID="hotels-loading">
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </Stack>
  );
}
