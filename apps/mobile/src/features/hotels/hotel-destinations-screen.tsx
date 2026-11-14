import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useDestinations } from "@ampm/api-client";
import type { DestinationBrowseItem } from "@ampm/core";
import {
  Card,
  EmptyState,
  Grid,
  Icon,
  ListItem,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { DestinationTile } from "./destination-tile";
import { useHotelSearchLayout } from "./hotel-search-layout";
import { destinationBrowseSubtitle, DISCOVERY_CLOSED, DISCOVERY_SIGN_IN } from "./hotels.format";

export interface HotelDestinationsScreenProps {
  /** The app's tab bar; the route supplies it and the screen only gives it room. */
  readonly tabBar?: ReactNode;
}

/**
 * Browse hotels by destination (CP-02, feature 9.4b): the destinations the account can reach, each with its
 * hotel count, opening that destination's hotels. A bounded reference set — a handful of places, not a feed.
 * No artboard of its own: a list on a phone and a tablet, D3's three-across tiles from 1024, on D5's split
 * width so it lines up with the search it is reached from.
 */
export function HotelDestinationsScreen({ tabBar }: HotelDestinationsScreenProps) {
  const router = useRouter();
  return (
    <Screen
      tabBar={tabBar}
      width="split"
      header={
        <ScreenHeader eyebrow="Hotel discovery" title="Destinations" onBack={() => router.back()} />
      }
    >
      <DestinationList
        onOpen={(item) =>
          router.push({
            pathname: "/hotels/destinations/[id]",
            params: { id: item.id, name: item.name },
          })
        }
      />
    </Screen>
  );
}

function DestinationList({ onOpen }: { readonly onOpen: (item: DestinationBrowseItem) => void }) {
  const destinations = useDestinations();
  const goToSignIn = useGoToSignIn();
  if (destinations.isPending) return <DestinationsLoading />;
  if (destinations.isError)
    return (
      <QueryErrorState
        error={destinations.error}
        onRetry={() => void destinations.refetch()}
        onSignIn={goToSignIn}
        signIn={DISCOVERY_SIGN_IN}
        notFound={DISCOVERY_CLOSED}
      />
    );
  const { items } = destinations.data;
  if (items.length === 0)
    return (
      <EmptyState
        icon="map-pin"
        title="No destinations yet"
        description="Destinations appear here once hotels are added to them."
        announce
      />
    );
  return <DestinationCards items={items} onOpen={onOpen} />;
}

interface DestinationCardsProps {
  readonly items: readonly DestinationBrowseItem[];
  readonly onOpen: (item: DestinationBrowseItem) => void;
}

/** The destinations as spaced glass rows, or tiles from 1024, each opening that destination's hotels. */
function DestinationCards({ items, onOpen }: DestinationCardsProps) {
  const isDesktop = useHotelSearchLayout() === "desktop";
  if (isDesktop)
    return (
      <Grid columns={{ md: 2, lg: 3 }} testID="destination-tiles">
        {items.map((item) => (
          <DestinationTile key={item.id} item={item} onPress={() => onOpen(item)} />
        ))}
      </Grid>
    );
  return (
    <Card padding="sm" className="md:p-6">
      <Stack gap={2}>
        {items.map((item) => (
          <ListItem
            key={item.id}
            title={item.name}
            subtitle={destinationBrowseSubtitle(item)}
            leading={<Icon name="map-pin" />}
            accessibilityLabel={`${item.name}, ${destinationBrowseSubtitle(item)}`}
            onPress={() => onOpen(item)}
          />
        ))}
      </Stack>
    </Card>
  );
}

const LOADING_ROWS = ["first", "second", "third"] as const;

/** Three rows, or three tiles from 1024, the size of what arrives. */
function DestinationsLoading() {
  const isDesktop = useHotelSearchLayout() === "desktop";
  if (isDesktop)
    return (
      <Grid columns={{ md: 2, lg: 3 }} testID="destinations-loading">
        {LOADING_ROWS.map((key) => (
          <Skeleton key={key} className="h-80 w-full rounded-xl" />
        ))}
      </Grid>
    );
  return (
    <Stack gap={2} testID="destinations-loading">
      {LOADING_ROWS.map((key) => (
        <Skeleton key={key} className="h-14 w-full" />
      ))}
    </Stack>
  );
}
