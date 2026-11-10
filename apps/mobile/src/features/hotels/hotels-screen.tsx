import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";

import { useHotels, useMe } from "@ampm/api-client";
import type { HotelDestinationView } from "@ampm/core";
import { Button, EmptyState, Input, QueryErrorState, Row, Screen, ScreenHeader } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { canBrowseHotels } from "../portal/portal.format";
import { DestinationFilter } from "./destination-filter";
import { HotelFilterBar } from "./hotel-filters";
import { HotelResults, HotelResultsLoading } from "./hotel-results";
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
    <Screen tabBar={tabBar} width="content" header={header}>
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
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<HotelFilters>({});
  const hotels = useHotels({
    q: q.trim() || undefined,
    destinationId: destination?.id,
    ...filters,
  });
  return (
    <>
      <Input
        label="Search hotels"
        leadingIcon="search"
        placeholder="Hotel name"
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
      />
      <DestinationFilter
        options={destinationOptions(hotels.data?.items ?? [], destination)}
        selected={destination}
        onChange={onDestination}
      />
      <HotelFilterBar value={filters} onChange={setFilters} />
      <HotelResults
        hotels={hotels}
        onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
        filtersActive={activeFilterCount(filters) > 0}
        onClearFilters={() => setFilters({})}
      />
    </>
  );
}

interface HotelsHeaderProps {
  readonly title: string;
  /** Opens the destinations browse; absent for an account that may not browse discovery. */
  readonly onBrowseDestinations: (() => void) | undefined;
  /** Opens the shortlist; without it (no shortlist on the account) the button stays out. */
  readonly onOpenSaved: (() => void) | undefined;
}

/** Titled by the chosen destination, as P3 heads its results; browse-by-destination and the shortlist at its right. */
function HotelsHeader({ title, onBrowseDestinations, onOpenSaved }: HotelsHeaderProps) {
  return (
    <ScreenHeader
      eyebrow="Hotel discovery"
      title={title}
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
