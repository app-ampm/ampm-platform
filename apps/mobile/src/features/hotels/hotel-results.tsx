import { View } from "react-native";

import type { useHotels } from "@ampm/api-client";
import type { HotelView } from "@ampm/core";
import {
  EmptyState,
  LoadMore,
  politeLiveRegion,
  QueryErrorState,
  Row,
  Skeleton,
  Stack,
  Text,
  useAnnounce,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { SaveHeartButton, useHotelPagePermissions } from "./hotel-actions";
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
  if (hotels.items.length === 0)
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
  return <HotelResultList hotels={hotels} onOpen={onOpen} />;
}

interface HotelResultListProps {
  readonly hotels: ReturnType<typeof useHotels>;
  readonly onOpen: (hotelId: string) => void;
}

/**
 * The found hotels, led by a polite live-region count so a live-applied filter is announced to a screen
 * reader (WCAG 4.1.3): the count going from "14 hotels" to "3 hotels" is spoken, not only shown. Below them
 * a "Load more" footer fetches the next page (B10); `hasMore` also drives the count's "+" when a page is cut.
 */
function HotelResultList({ hotels, onOpen }: HotelResultListProps) {
  const countLabel = hotelCountLabel(hotels.items.length, hotels.hasMore);
  const { canSave } = useHotelPagePermissions();
  useAnnounce(countLabel, true, { web: true });
  return (
    <Stack gap={3}>
      <Text variant="eyebrow" {...politeLiveRegion()}>
        {countLabel}
      </Text>
      {hotels.items.map((hotel) => (
        <HotelResultCard key={hotel.id} hotel={hotel} canSave={canSave} onOpen={onOpen} />
      ))}
      <LoadMore
        hasMore={hotels.hasMore}
        loading={hotels.isLoadingMore}
        failed={hotels.loadMoreError}
        onLoadMore={hotels.loadMore}
        testID="hotels-load-more"
      />
    </Stack>
  );
}

interface HotelResultCardProps {
  readonly hotel: HotelView;
  /** Whether the account keeps a shortlist; the heart shows only then (the server still decides). */
  readonly canSave: boolean;
  readonly onOpen: (hotelId: string) => void;
}

/**
 * A result card with its shortlist heart (B12, D5): the heart sits BESIDE the pressable card, never inside
 * it, so pressing it saves the hotel instead of opening it and a screen reader reaches it on its own (the
 * pressable Card collapses its children — WCAG 1.3.1; the same idiom as the saved-hotel row's remove button,
 * and clear of the card's photo caption and star chip). The heart names the hotel (WCAG 2.4.4) and shows
 * only for an account that keeps a shortlist.
 */
function HotelResultCard({ hotel, canSave, onOpen }: HotelResultCardProps) {
  return (
    <Row gap={2} align="start">
      <View className="flex-1">
        <HotelCard hotel={hotel} onPress={() => onOpen(hotel.id)} />
      </View>
      {canSave ? <SaveHeartButton hotel={hotel} namedLabel /> : null}
    </Row>
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
