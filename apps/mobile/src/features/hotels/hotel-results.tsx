import { View } from "react-native";

import { type useHotels, useSaveHotels } from "@ampm/api-client";
import { HOTEL_COMPARE_MIN, type HotelView } from "@ampm/core";
import {
  Button,
  EmptyState,
  LoadMore,
  politeLiveRegion,
  QueryErrorState,
  Row,
  Skeleton,
  Stack,
  Text,
  useAnnounce,
  useToast,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { SaveHeartButton, useHotelPagePermissions } from "./hotel-actions";
import { HotelCard } from "./hotel-card";
import {
  CompareBar,
  HotelCompareCheckbox,
  useHotelCompareSelection,
  type HotelCompareSelection,
} from "./hotel-compare-select";
import {
  DISCOVERY_CLOSED,
  DISCOVERY_SIGN_IN,
  destinationLabel,
  hotelCountLabel,
} from "./hotels.format";

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
 * Discovery's compare mode (B12b): the shared 2–4 pick, but a picked hotel is saved to the shortlist before
 * the compare opens, because the compare endpoint returns only saved hotels — so comparing a browse card
 * first adds it to the shortlist. A failed save keeps the picks and tells the user, so the compare never
 * opens missing a column.
 */
function useDiscoveryCompare(): HotelCompareSelection {
  const saveHotels = useSaveHotels();
  const toast = useToast();
  return useHotelCompareSelection(async (ids) => {
    try {
      await saveHotels.mutateAsync(ids);
    } catch (error) {
      toast.show({ title: "Could not add those hotels to compare", tone: "danger" });
      throw error;
    }
  });
}

/**
 * The found hotels, led by a polite live-region count so a live-applied filter is announced to a screen
 * reader (WCAG 4.1.3). "Compare" turns the cards into a 2–4 pick that opens the side-by-side (B12b); below
 * them a "Load more" footer fetches the next page (B10), and `hasMore` drives the count's "+" when cut.
 */
function HotelResultList({ hotels, onOpen }: HotelResultListProps) {
  const countLabel = hotelCountLabel(hotels.items.length, hotels.hasMore);
  const { canSave } = useHotelPagePermissions();
  const compare = useDiscoveryCompare();
  const canCompare = canSave && hotels.items.length >= HOTEL_COMPARE_MIN;
  useAnnounce(countLabel, true, { web: true });
  return (
    <Stack gap={3}>
      <CompareToggleRow
        countLabel={countLabel}
        comparing={compare.comparing}
        show={canCompare || compare.comparing}
        onToggle={compare.comparing ? compare.exit : compare.start}
      />
      {compare.comparing ? <CompareShortlistNote /> : null}
      <HotelResultItems hotels={hotels} compare={compare} canSave={canSave} onOpen={onOpen} />
      <LoadMore
        hasMore={hotels.hasMore}
        loading={hotels.isLoadingMore}
        failed={hotels.loadMoreError}
        onLoadMore={hotels.loadMore}
        testID="hotels-load-more"
      />
      {compare.comparing ? (
        <CompareBar
          count={compare.selected.length}
          opening={compare.opening}
          onCompare={compare.open}
        />
      ) : null}
    </Stack>
  );
}

interface CompareToggleRowProps {
  readonly countLabel: string;
  readonly comparing: boolean;
  /** Whether the compare toggle shows: the account can compare, or is already in compare mode. */
  readonly show: boolean;
  readonly onToggle: () => void;
}

/** The result count, with the compare toggle beside it (enter the 2–4 pick, or leave it). */
function CompareToggleRow({ countLabel, comparing, show, onToggle }: CompareToggleRowProps) {
  return (
    <Row gap={3} justify="between" align="center">
      <Text variant="eyebrow" {...politeLiveRegion()}>
        {countLabel}
      </Text>
      {show ? (
        <Button variant="glass" size="sm" icon={comparing ? "x" : "list-checks"} onPress={onToggle}>
          {comparing ? "Cancel" : "Compare"}
        </Button>
      ) : null}
    </Row>
  );
}

/** Compare saves before it opens, so comparing adds the picks to the shortlist — say so plainly. */
function CompareShortlistNote() {
  return (
    <Text variant="caption" tone="muted">
      Hotels you compare are added to your shortlist.
    </Text>
  );
}

interface HotelResultItemsProps {
  readonly hotels: ReturnType<typeof useHotels>;
  readonly compare: HotelCompareSelection;
  readonly canSave: boolean;
  readonly onOpen: (hotelId: string) => void;
}

/** The found hotels: compare picks while comparing, otherwise the result cards with their save heart. */
function HotelResultItems({ hotels, compare, canSave, onOpen }: HotelResultItemsProps) {
  return (
    <>
      {hotels.items.map((hotel) =>
        compare.comparing ? (
          <HotelCompareCheckbox
            key={hotel.id}
            hotelId={hotel.id}
            name={hotel.name}
            destinationText={destinationLabel(hotel.destination)}
            selected={compare.selected}
            onToggle={compare.toggle}
          />
        ) : (
          <HotelResultCard key={hotel.id} hotel={hotel} canSave={canSave} onOpen={onOpen} />
        ),
      )}
    </>
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
