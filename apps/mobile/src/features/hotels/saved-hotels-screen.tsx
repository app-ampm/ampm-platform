import { useRouter } from "expo-router";
import { type ReactNode } from "react";

import { useMe, useSavedHotels } from "@ampm/api-client";
import { HOTEL_COMPARE_MIN } from "@ampm/core";
import {
  Button,
  Card,
  EmptyState,
  LoadMore,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { canBrowseHotels } from "../portal/portal.format";
import { CompareBar, HotelCompareCheckbox, useHotelCompareSelection } from "./hotel-compare-select";
import { destinationLabel, hotelCountLabel } from "./hotels.format";
import { SavedHotelRow } from "./saved-hotel-row";

export interface SavedHotelsScreenProps {
  /** The app's tab bar; the route supplies it and the screen only gives it room. */
  readonly tabBar?: ReactNode;
}

/**
 * The account's hotel shortlist (Module C; D7 and P2 "My selection"): the hotels saved from discovery as
 * rows, each opening its page or removed. "Compare" turns the list into a 2–4 pick that opens the
 * side-by-side compare (CP-06); it shows only when the account can still browse and has at least two saved.
 */
export function SavedHotelsScreen({ tabBar }: SavedHotelsScreenProps) {
  const router = useRouter();
  const saved = useSavedHotels();
  const me = useMe();
  const canBrowse = me.data ? canBrowseHotels(me.data) : false;
  const compare = useHotelCompareSelection();
  const canCompare = canBrowse && saved.items.length >= HOTEL_COMPARE_MIN;
  return (
    <Screen
      tabBar={tabBar}
      width="content"
      header={
        <SavedHeader
          comparing={compare.comparing}
          canCompare={canCompare}
          onBack={() => router.back()}
          onToggleMode={compare.comparing ? compare.exit : compare.start}
        />
      }
    >
      <SavedList
        saved={saved}
        comparing={compare.comparing}
        selected={compare.selected}
        onToggle={compare.toggle}
        onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
        // Back to the search when it is already under this screen, instead of piling a second one on.
        onBrowse={canBrowse ? () => router.dismissTo("/hotels") : undefined}
      />
      {compare.comparing ? (
        <CompareBar count={compare.selected.length} onCompare={compare.open} />
      ) : null}
    </Screen>
  );
}

interface SavedHeaderProps {
  readonly comparing: boolean;
  readonly canCompare: boolean;
  readonly onBack: () => void;
  readonly onToggleMode: () => void;
}

/** The shortlist header; its Compare toggle enters or leaves the 2–4 pick (only when comparing is possible). */
function SavedHeader({ comparing, canCompare, onBack, onToggleMode }: SavedHeaderProps) {
  return (
    <ScreenHeader
      eyebrow="Saved hotels"
      title="My selection"
      onBack={onBack}
      trailing={
        canCompare ? (
          <Button
            variant="glass"
            size="sm"
            icon={comparing ? "x" : "list-checks"}
            onPress={onToggleMode}
          >
            {comparing ? "Cancel" : "Compare"}
          </Button>
        ) : undefined
      }
    />
  );
}

interface SavedListProps {
  readonly saved: ReturnType<typeof useSavedHotels>;
  readonly comparing: boolean;
  readonly selected: readonly string[];
  readonly onToggle: (hotelId: string) => void;
  readonly onOpen: (hotelId: string) => void;
  /** Opens the search from the empty shortlist; absent for an account that may not search. */
  readonly onBrowse: (() => void) | undefined;
}

function SavedList({ saved, comparing, selected, onToggle, onOpen, onBrowse }: SavedListProps) {
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
  if (saved.items.length === 0)
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
    <SavedCardList
      saved={saved}
      comparing={comparing}
      selected={selected}
      onToggle={onToggle}
      onOpen={onOpen}
    />
  );
}

/** The shortlist as its glass card: the count, the rows (or the 2–4 compare picks), and a "Load more" footer (B10). */
function SavedCardList({
  saved,
  comparing,
  selected,
  onToggle,
  onOpen,
}: Omit<SavedListProps, "onBrowse">) {
  return (
    <Card padding="sm" className="md:p-6">
      <Text variant="eyebrow" className="pb-2">
        {hotelCountLabel(saved.items.length, saved.hasMore)}
      </Text>
      {saved.items.map((item) =>
        comparing ? (
          <HotelCompareCheckbox
            key={item.id}
            hotelId={item.hotel.id}
            name={item.hotel.name}
            destinationText={destinationLabel(item.hotel.destination)}
            selected={selected}
            onToggle={onToggle}
          />
        ) : (
          <SavedHotelRow key={item.id} item={item} onOpen={() => onOpen(item.hotel.id)} />
        ),
      )}
      <LoadMore
        hasMore={saved.hasMore}
        loading={saved.isLoadingMore}
        failed={saved.loadMoreError}
        onLoadMore={saved.loadMore}
        testID="saved-load-more"
      />
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
