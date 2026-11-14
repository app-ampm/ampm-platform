import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";

import { useHotels, useMe } from "@ampm/api-client";
import type { HotelDestinationView } from "@ampm/core";
import { Button, EmptyState, Input, QueryErrorState, Row, Screen, ScreenHeader } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { canBrowseHotels } from "../portal/portal.format";
import { DestinationFilter } from "./destination-filter";
import { HotelFiltersButton } from "./hotel-filter-sheet";
import { HotelFilterBar, VerifiedRatesChip } from "./hotel-filters";
import { HotelResults, HotelResultsLoading } from "./hotel-results";
import { useHotelSearchLayout } from "./hotel-search-layout";
import { HotelSearchPill } from "./hotel-search-pill";
import {
  activeFilterCount,
  DISCOVERY_CLOSED,
  DISCOVERY_SIGN_IN,
  destinationOptions,
  type HotelFilters,
} from "./hotels.format";

export interface HotelsScreenProps {
  /** The app's tab bar; the route supplies it and the screen only gives it room. */
  readonly tabBar?: ReactNode;
}

type Destination = HotelDestinationView | null;

/**
 * Hotel discovery (Module C; D5 search results, P3 hotel search): search the hotels the subscription
 * unlocks by name, narrow them to a destination, open one. `/me` decides first: an account without
 * hotel discovery (a client who has not paid yet, or whose subscription lapsed) is pointed to the plans
 * and never searches, and the shortlist button shows only to an account that keeps a shortlist.
 */
export function HotelsScreen({ tabBar }: HotelsScreenProps) {
  const router = useRouter();
  const me = useMe();
  const [destination, setDestination] = useState<Destination>(null);
  const hasShortlist = me.data?.entitlements.modules.includes("saved_hotels") ?? false;
  const canBrowse = me.data ? canBrowseHotels(me.data) : false;
  const header = (
    <HotelsHeader
      title={destination?.name ?? "Hotels"}
      onBrowseDestinations={canBrowse ? () => router.push("/hotels/destinations") : undefined}
      onOpenSaved={hasShortlist ? () => router.push("/hotels/saved") : undefined}
    />
  );
  return (
    <Screen tabBar={tabBar} width="split" header={header}>
      <HotelsBody me={me} destination={destination} onDestination={setDestination} />
    </Screen>
  );
}

interface SearchProps {
  readonly destination: Destination;
  readonly onDestination: (destination: Destination) => void;
}

interface HotelsBodyProps extends SearchProps {
  readonly me: ReturnType<typeof useMe>;
}

/** `/me` first: loading, its failures, the closed search with the way to the plans, or the search. */
function HotelsBody({ me, destination, onDestination }: HotelsBodyProps) {
  const router = useRouter();
  const goToSignIn = useGoToSignIn();
  if (!me.data) {
    if (!me.isError) return <HotelResultsLoading />;
    return (
      <QueryErrorState
        error={me.error}
        onRetry={() => void me.refetch()}
        onSignIn={goToSignIn}
        signIn={DISCOVERY_SIGN_IN}
      />
    );
  }
  if (!canBrowseHotels(me.data))
    return (
      <EmptyState
        {...DISCOVERY_CLOSED}
        action={{
          label: "See plans",
          variant: "primary",
          onPress: () => router.dismissTo("/portal"),
        }}
      />
    );
  return <HotelSearch destination={destination} onDestination={onDestination} />;
}

/** The search itself, mounted only for an account that holds hotel discovery. */
function HotelSearch({ destination, onDestination }: SearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<HotelFilters>({});
  const hotels = useHotels({
    q: query.trim() || undefined,
    destinationId: destination?.id,
    ...filters,
  });
  const search: SearchState = {
    query,
    onQueryChange: setQuery,
    filters,
    onFiltersChange: setFilters,
    destinations: destinationOptions(hotels.items, destination),
    destination,
    onDestination,
  };
  const results = (toolbar?: ReactNode) => (
    <HotelResults
      hotels={hotels}
      onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
      filtersActive={activeFilterCount(filters) > 0}
      onClearFilters={() => setFilters({})}
      toolbar={toolbar}
    />
  );
  return <SearchArrangement search={search} results={results} />;
}

/** What the search holds and changes, handed to the arrangement for this window. */
interface SearchState extends SearchProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly filters: HotelFilters;
  readonly onFiltersChange: (filters: HotelFilters) => void;
  /** The destination chips on offer (`destinationOptions`). */
  readonly destinations: readonly HotelDestinationView[];
}

interface SearchArrangementProps {
  readonly search: SearchState;
  /** The results, with the search's chip row when it shares the count's row (D5). */
  readonly results: (toolbar?: ReactNode) => ReactNode;
}

/**
 * The search laid out for the window. A phone (P3) keeps the name search over one chip row (the Filters
 * pill, verified rates, the destinations); a tablet keeps the filter rows; from 1024 (D5) one pill holds
 * the name search and the selects, and the chips share the result count's row. Every arrangement fills
 * the same four slots, null where it has nothing, so the results keep their place in the tree when the
 * window crosses a breakpoint (an iPad turning, a browser resized) and keep their compare picks.
 */
function SearchArrangement({ search, results }: SearchArrangementProps) {
  const layout = useHotelSearchLayout();
  const filterProps = { value: search.filters, onChange: search.onFiltersChange };
  const verified = <VerifiedRatesChip {...filterProps} />;
  const phoneChips = (
    <>
      <HotelFiltersButton {...filterProps} />
      {verified}
    </>
  );
  const isDesktop = layout === "desktop";
  return (
    <>
      {isDesktop ? (
        <HotelSearchPill
          query={search.query}
          onQueryChange={search.onQueryChange}
          {...filterProps}
        />
      ) : (
        <NameSearch value={search.query} onChange={search.onQueryChange} />
      )}
      {isDesktop ? null : (
        <SearchChips search={search} leading={layout === "phone" ? phoneChips : undefined} />
      )}
      {layout === "tablet" ? <HotelFilterBar {...filterProps} /> : null}
      {results(isDesktop ? <SearchChips search={search} leading={verified} /> : undefined)}
    </>
  );
}

/** The search's chip row: the destinations, after any leading chips. */
function SearchChips({
  search,
  leading,
}: {
  readonly search: SearchState;
  readonly leading?: ReactNode;
}) {
  return (
    <DestinationFilter
      options={search.destinations}
      selected={search.destination}
      onChange={search.onDestination}
      leading={leading}
    />
  );
}

/** The hotel-name search on a phone and a tablet; from 1024 it moves into the search pill. */
function NameSearch({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <Input
      label="Search hotels"
      leadingIcon="search"
      placeholder="Hotel name"
      value={value}
      onChangeText={onChange}
      returnKeyType="search"
    />
  );
}

interface HotelsHeaderProps {
  readonly title: string;
  /** Opens the destinations browse; absent for an account that may not browse discovery. */
  readonly onBrowseDestinations: (() => void) | undefined;
  /** Opens the shortlist; without it (no shortlist on the account) the button stays out. */
  readonly onOpenSaved: (() => void) | undefined;
}

/**
 * Titled by the chosen destination, as P3 heads its results; browse-by-destination and the shortlist at
 * its right. D5 has no page title, its search pill leads the page: from 1024 the heading stays for
 * screen readers and the page's outline, at a subheading's 28 instead of a title's 44.
 */
function HotelsHeader({ title, onBrowseDestinations, onOpenSaved }: HotelsHeaderProps) {
  return (
    <ScreenHeader
      eyebrow="Hotel discovery"
      title={title}
      titleClassName="lg:text-3xl"
      trailing={
        <Row gap={2}>
          {onBrowseDestinations ? (
            <Button
              variant="glass"
              size="sm"
              icon="map-pin"
              onPress={onBrowseDestinations}
              accessibilityLabel="Browse destinations"
            />
          ) : null}
          {onOpenSaved ? (
            <Button variant="glass" size="sm" icon="heart" onPress={onOpenSaved}>
              Saved
            </Button>
          ) : null}
        </Row>
      }
    />
  );
}
