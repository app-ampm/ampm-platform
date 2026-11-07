import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useMe, useSavedHotels } from "@ampm/api-client";
import {
  Card,
  EmptyState,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { canBrowseHotels } from "../portal/portal.format";
import { hotelCountLabel } from "./hotels.format";
import { SavedHotelRow } from "./saved-hotel-row";

export interface SavedHotelsScreenProps {
  /** The app's tab bar; the route supplies it and the screen only gives it room. */
  readonly tabBar?: ReactNode;
}

/**
 * The account's hotel shortlist (Module C; D7 and P2 "My selection"): the hotels saved from
 * discovery as rows in one glass card, each opening its hotel page or removed from the list. Empty,
 * it offers the search when the account may search (a lapsed subscription keeps its saved names only).
 */
export function SavedHotelsScreen({ tabBar }: SavedHotelsScreenProps) {
  const router = useRouter();
  const saved = useSavedHotels();
  const me = useMe();
  const canBrowse = me.data ? canBrowseHotels(me.data) : false;
  return (
    <Screen
      tabBar={tabBar}
      width="content"
      header={
        <ScreenHeader eyebrow="Saved hotels" title="My selection" onBack={() => router.back()} />
      }
    >
      <SavedList
        saved={saved}
        onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
        // Back to the search when it is already under this screen, instead of piling a second one on.
        onBrowse={canBrowse ? () => router.dismissTo("/hotels") : undefined}
      />
    </Screen>
  );
}

interface SavedListProps {
  readonly saved: ReturnType<typeof useSavedHotels>;
  readonly onOpen: (hotelId: string) => void;
  /** Opens the search from the empty shortlist; absent for an account that may not search. */
  readonly onBrowse: (() => void) | undefined;
}

function SavedList({ saved, onOpen, onBrowse }: SavedListProps) {
  const goToSignIn = useGoToSignIn();
  if (saved.isPending) return <SavedLoading />;
  if (saved.isError)
    return (
      <QueryErrorState
        error={saved.error}
        onRetry={() => void saved.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view your shortlist" }}
      />
    );
  const { items, nextCursor } = saved.data;
  if (items.length === 0)
    return (
      <EmptyState
        icon="inbox"
        title="No saved hotels yet"
        description="Save a hotel from discovery to build your shortlist."
        action={
          onBrowse ? { label: "Browse hotels", variant: "primary", onPress: onBrowse } : undefined
        }
      />
    );
  return (
    <Card padding="sm" className="md:p-6">
      <Text variant="eyebrow" className="pb-2">
        {hotelCountLabel(items.length, nextCursor !== null)}
      </Text>
      {items.map((item) => (
        <SavedHotelRow key={item.id} item={item} onOpen={() => onOpen(item.hotel.id)} />
      ))}
    </Card>
  );
}

function SavedLoading() {
  return (
    <Stack gap={3} testID="saved-hotels-loading">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </Stack>
  );
}
