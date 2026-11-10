import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useDestinations } from "@ampm/api-client";
import type { DestinationBrowseItem } from "@ampm/core";
import {
  Card,
  EmptyState,
  Icon,
  ListItem,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { destinationBrowseSubtitle, DISCOVERY_CLOSED, DISCOVERY_SIGN_IN } from "./hotels.format";

export interface HotelDestinationsScreenProps {
  /** The app's tab bar; the route supplies it and the screen only gives it room. */
  readonly tabBar?: ReactNode;
}

/**
 * Browse hotels by destination (CP-02, feature 9.4b): the destinations the account can reach, each with its
 * hotel count, opening that destination's hotels. A bounded reference set — a handful of places, not a feed.
 */
export function HotelDestinationsScreen({ tabBar }: HotelDestinationsScreenProps) {
  const router = useRouter();
  return (
    <Screen
      tabBar={tabBar}
      width="content"
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

/** The destinations as spaced glass rows, each opening that destination's hotels. */
function DestinationCards({ items, onOpen }: DestinationCardsProps) {
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

function DestinationsLoading() {
  return (
    <Stack gap={2} testID="destinations-loading">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </Stack>
  );
}
