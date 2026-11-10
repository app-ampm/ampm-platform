import type { useHotels } from "@ampm/api-client";
import type { HotelView } from "@ampm/core";
import {
  EmptyState,
  politeLiveRegion,
  QueryErrorState,
  Skeleton,
  Stack,
  Text,
  useAnnounce,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelCard } from "./hotel-card";
import { DISCOVERY_CLOSED, DISCOVERY_SIGN_IN, hotelCountLabel } from "./hotels.format";

export interface HotelResultsProps {
  readonly hotels: ReturnType<typeof useHotels>;
  readonly onOpen: (hotelId: string) => void;
  /** When filters are active, the empty state offers to clear them, not just "try another search". */
  readonly filtersActive?: boolean;
  readonly onClearFilters?: () => void;
}

/**
 * The results in every state: loading, offline, signed out, refused (the server's 404 when the account
 * no longer holds hotel discovery), failed, nothing found, or the cards.
 */
export function HotelResults({
  hotels,
  onOpen,
  filtersActive = false,
  onClearFilters,
}: HotelResultsProps) {
  const goToSignIn = useGoToSignIn();
  if (hotels.isPending) return <HotelResultsLoading />;
  if (hotels.isError)
    return (
      <QueryErrorState
        error={hotels.error}
        onRetry={() => void hotels.refetch()}
        onSignIn={goToSignIn}
        signIn={DISCOVERY_SIGN_IN}
        notFound={DISCOVERY_CLOSED}
      />
    );
  const { items, nextCursor } = hotels.data;
  if (items.length === 0)
    return filtersActive && onClearFilters ? (
      <EmptyState
        icon="inbox"
        title="No hotels match these filters"
        description="Try widening or clearing your filters."
        action={{ label: "Clear filters", variant: "secondary", onPress: onClearFilters }}
        announce
      />
    ) : (
      <EmptyState
        icon="inbox"
        title="No hotels found"
        description="Try a different search."
        announce
      />
    );
  return <HotelResultList items={items} nextCursor={nextCursor} onOpen={onOpen} />;
}

interface HotelResultListProps {
  readonly items: readonly HotelView[];
  readonly nextCursor: string | null;
  readonly onOpen: (hotelId: string) => void;
}

/**
 * The found hotels, led by a polite live-region count so a live-applied filter is announced to a screen
 * reader (WCAG 4.1.3): the count going from "14 hotels" to "3 hotels" is spoken, not only shown.
 */
function HotelResultList({ items, nextCursor, onOpen }: HotelResultListProps) {
  const countLabel = hotelCountLabel(items.length, nextCursor !== null);
  useAnnounce(countLabel, true, { web: true });
  return (
    <Stack gap={3}>
      <Text variant="eyebrow" {...politeLiveRegion()}>
        {countLabel}
      </Text>
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
