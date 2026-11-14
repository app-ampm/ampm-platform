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
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
  useLayoutAt,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { canBrowseHotels } from "../portal/portal.format";
import {
  CompareBar,
  HotelCompareCheckbox,
  useHotelCompareSelection,
  type HotelCompareSelection,
} from "./hotel-compare-select";
import { destinationLabel, hotelCountLabel } from "./hotels.format";
import { SavedHotelGrid } from "./saved-hotel-grid";
import { SavedHotelNoteSheet } from "./saved-hotel-note-sheet";
import { SavedHotelRow } from "./saved-hotel-row";
import { useSavedNoteEditor } from "./use-saved-hotel-controls";

export interface SavedHotelsScreenProps {
  /** The app's tab bar; the route supplies it and the screen only gives it room. */
  readonly tabBar?: ReactNode;
}

/**
 * The account's hotel shortlist (Module C; D7 and P2 "My selection"): the hotels saved from discovery as
 * rows on a phone and a tablet, and side by side as D7's columns on a desktop, each opening its page,
 * annotated or removed. "Compare" turns the list into a 2–4 pick that opens the side-by-side compare
 * (CP-06); it shows only when the account can still browse and has at least two saved.
 */
export function SavedHotelsScreen({ tabBar }: SavedHotelsScreenProps) {
  const router = useRouter();
  const saved = useSavedHotels();
  const canBrowse = useCanBrowseHotels();
  // Held above the phone list / desktop grid switch, so crossing 1024 keeps the picks and an open note.
  const compare = useHotelCompareSelection();
  const notes = useSavedNoteEditor();
  const isDesktop = useLayoutAt("lg");
  return (
    <Screen
      tabBar={tabBar}
      width="wide"
      header={
        <SavedHeader
          compare={compare}
          canCompare={canBrowse && saved.items.length >= HOTEL_COMPARE_MIN}
          // The phone keeps the count in its card; a desktop sets it at the title's right, as D7 does.
          count={isDesktop ? savedCount(saved) : undefined}
          onBack={() => router.back()}
        />
      }
    >
      <SavedList
        saved={saved}
        isDesktop={isDesktop}
        comparing={compare.comparing}
        selected={compare.selected}
        onToggle={compare.toggle}
        onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
        onEditNote={notes.start}
        // Back to the search when it is already under this screen, instead of piling a second one on.
        onBrowse={canBrowse ? () => router.dismissTo("/hotels") : undefined}
      />
      {compare.comparing ? (
        <CompareBar count={compare.selected.length} onCompare={compare.open} />
      ) : null}
      <SavedHotelNoteSheet entries={saved.items} editor={notes} />
    </Screen>
  );
}

/** Whether the account may still search (a lapsed one keeps its saved names only); false while /me loads. */
function useCanBrowseHotels(): boolean {
  const me = useMe();
  return me.data ? canBrowseHotels(me.data) : false;
}

/** "3 hotels", or nothing while the shortlist is loading or empty. */
function savedCount(saved: ReturnType<typeof useSavedHotels>): string | undefined {
  return saved.items.length > 0 ? hotelCountLabel(saved.items.length, saved.hasMore) : undefined;
}

interface SavedHeaderProps {
  readonly compare: HotelCompareSelection;
  readonly canCompare: boolean;
  /** "3 hotels" at the title's right on a desktop; absent on a phone, whose card says it. */
  readonly count: string | undefined;
  readonly onBack: () => void;
}

/** The shortlist header; its Compare toggle enters or leaves the 2–4 pick (only when comparing is possible). */
function SavedHeader({ compare, canCompare, count, onBack }: SavedHeaderProps) {
  const { comparing } = compare;
  const toggle = canCompare ? (
    <Button
      variant="glass"
      size="sm"
      icon={comparing ? "x" : "list-checks"}
      onPress={comparing ? compare.exit : compare.start}
    >
      {comparing ? "Cancel" : "Compare"}
    </Button>
  ) : null;
  return (
    <ScreenHeader
      size="display"
      // D7's 53px title on a desktop; a phone keeps its 36.
      titleClassName="text-4xl lg:text-6xl"
      eyebrow="Saved hotels"
      title="My selection"
      onBack={onBack}
      trailing={
        count || toggle ? (
          <Row gap={4} align="center">
            {count ? (
              <Text variant="bodySmall" tone="muted">
                {count}
              </Text>
            ) : null}
            {toggle}
          </Row>
        ) : undefined
      }
    />
  );
}

interface SavedListProps {
  readonly saved: ReturnType<typeof useSavedHotels>;
  readonly isDesktop: boolean;
  readonly comparing: boolean;
  readonly selected: readonly string[];
  readonly onToggle: (hotelId: string) => void;
  readonly onOpen: (hotelId: string) => void;
  readonly onEditNote: (entryId: string) => void;
  /** Opens the search from the empty shortlist; absent for an account that may not search. */
  readonly onBrowse: (() => void) | undefined;
}

function SavedList({ saved, isDesktop, onBrowse, ...picks }: SavedListProps) {
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
  return isDesktop ? (
    <SavedHotelGrid saved={saved} {...picks} />
  ) : (
    <SavedCardList saved={saved} {...picks} />
  );
}

/** The shortlist as its glass card: the count, the rows (or the 2–4 compare picks), and a "Load more" footer (B10). */
function SavedCardList({
  saved,
  comparing,
  selected,
  onToggle,
  onOpen,
  onEditNote,
}: Omit<SavedListProps, "onBrowse" | "isDesktop">) {
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
          <SavedHotelRow key={item.id} item={item} onOpen={onOpen} onEditNote={onEditNote} />
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
