import type { ReactNode } from "react";
import { View } from "react-native";

import { type useHotels, useSaveHotels } from "@ampm/api-client";
import { HOTEL_COMPARE_MIN, type HotelView } from "@ampm/core";
import {
  Button,
  EmptyState,
  Grid,
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
import { useHotelSearchLayout } from "./hotel-search-layout";
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
  /**
   * The search's chip row (D5, from 1024): it shares the row of the result count, which sits at its
   * right, and stays above the loading, empty and error states so the filters remain in reach.
   */
  readonly toolbar?: ReactNode;
}

/**
 * The results in every state: loading, offline, signed out, refused (the server's 404 when the account
 * no longer holds hotel discovery), failed, nothing found, or the cards.
 */
export function HotelResults({ toolbar, ...props }: HotelResultsProps) {
  const { hotels, onOpen } = props;
  if (!hotels.isPending && !hotels.isError && hotels.items.length > 0)
    return <HotelResultList hotels={hotels} onOpen={onOpen} toolbar={toolbar} />;
  if (!toolbar) return <HotelResultsState {...props} />;
  return (
    <Stack gap={4}>
      {toolbar}
      <HotelResultsState {...props} />
    </Stack>
  );
}

/** Every state but the cards: loading, the failures, else nothing found (with a way to clear filters). */
function HotelResultsState({
  hotels,
  filtersActive = false,
  onClearFilters,
}: Omit<HotelResultsProps, "toolbar">) {
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
}

interface HotelResultListProps {
  readonly hotels: ReturnType<typeof useHotels>;
  readonly onOpen: (hotelId: string) => void;
  readonly toolbar: ReactNode;
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
function HotelResultList({ hotels, onOpen, toolbar }: HotelResultListProps) {
  const countLabel = hotelCountLabel(hotels.items.length, hotels.hasMore);
  const { canSave } = useHotelPagePermissions();
  const compare = useDiscoveryCompare();
  const canCompare = canSave && hotels.items.length >= HOTEL_COMPARE_MIN;
  useAnnounce(countLabel, true, { web: true });
  return (
    <Stack gap={3}>
      <CompareToggleRow
        toolbar={toolbar}
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
  /** The search's chip row, leading the count's row from 1024 (D5); absent on narrower windows. */
  readonly toolbar: ReactNode;
  readonly countLabel: string;
  readonly comparing: boolean;
  /** Whether the compare toggle shows: the account can compare, or is already in compare mode. */
  readonly show: boolean;
  readonly onToggle: () => void;
}

/**
 * The result count, with the compare toggle beside it (enter the 2–4 pick, or leave it). With the
 * search's chips (D5) the row leads with them and the count and toggle sit at its right.
 */
function CompareToggleRow({
  toolbar,
  countLabel,
  comparing,
  show,
  onToggle,
}: CompareToggleRowProps) {
  const count = (
    <Text variant="eyebrow" {...politeLiveRegion()}>
      {countLabel}
    </Text>
  );
  const toggle = show ? (
    <Button variant="glass" size="sm" icon={comparing ? "x" : "list-checks"} onPress={onToggle}>
      {comparing ? "Cancel" : "Compare"}
    </Button>
  ) : null;
  if (!toolbar)
    return (
      <Row gap={3} justify="between" align="center">
        {count}
        {toggle}
      </Row>
    );
  return (
    <Row gap={4} align="center" testID="hotels-toolbar">
      <View className="min-w-0 flex-1">{toolbar}</View>
      {count}
      {toggle}
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

/**
 * The found hotels: compare picks while comparing, otherwise the result cards with their save heart. One
 * column below 1024; two from it, D5's list taking the page while its map is not built.
 */
function HotelResultItems({ hotels, compare, canSave, onOpen }: HotelResultItemsProps) {
  const isDesktop = useHotelSearchLayout() === "desktop";
  return (
    <Grid columns={{ md: 1, lg: 2 }} gap={isDesktop ? 4.5 : 3} testID="hotels-grid">
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
    </Grid>
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
 * only for an account that keeps a shortlist. The card fills its grid cell, so two side by side are as
 * tall as each other; it grows down the cell rather than taking `flex-1`, whose zero basis collapses a
 * card in an auto-height cell on native.
 */
function HotelResultCard({ hotel, canSave, onOpen }: HotelResultCardProps) {
  return (
    <Row gap={2} align="start" className="grow">
      <View className="flex-1 self-stretch">
        <HotelCard hotel={hotel} onPress={() => onOpen(hotel.id)} className="grow" />
      </View>
      {canSave ? <SaveHeartButton hotel={hotel} namedLabel /> : null}
    </Row>
  );
}

const LOADING_CARDS = ["first", "second", "third", "fourth"] as const;

/**
 * Result-card skeletons laid out as the cards will be (three down a column, two rows of two from 1024),
 * so nothing jumps when they arrive.
 */
export function HotelResultsLoading() {
  const isDesktop = useHotelSearchLayout() === "desktop";
  return (
    <Grid columns={{ md: 1, lg: 2 }} gap={isDesktop ? 4.5 : 3} testID="hotels-loading">
      {LOADING_CARDS.slice(0, isDesktop ? 4 : 3).map((key) => (
        <Skeleton key={key} className="h-56 w-full rounded-lg" />
      ))}
    </Grid>
  );
}
