import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";

import { useMe, useSavedHotels } from "@ampm/api-client";
import { HOTEL_COMPARE_MAX, HOTEL_COMPARE_MIN, type SavedHotelView } from "@ampm/core";
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  LoadMore,
  politeLiveRegion,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
  useAnnounce,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { canBrowseHotels } from "../portal/portal.format";
import { destinationLabel, hotelCountLabel } from "./hotels.format";
import { SavedHotelRow } from "./saved-hotel-row";

export interface SavedHotelsScreenProps {
  /** The app's tab bar; the route supplies it and the screen only gives it room. */
  readonly tabBar?: ReactNode;
}

/** Compare-mode state: which saved hotels are picked (2–4) and opening the side-by-side with them. */
function useCompareSelection() {
  const router = useRouter();
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const toggle = (hotelId: string): void =>
    setSelected((current) =>
      current.includes(hotelId)
        ? current.filter((id) => id !== hotelId)
        : current.length >= HOTEL_COMPARE_MAX
          ? current
          : [...current, hotelId],
    );
  const exit = (): void => {
    setComparing(false);
    setSelected([]);
  };
  const open = (): void => {
    router.push({ pathname: "/hotels/compare", params: { ids: selected.join(",") } });
    exit();
  };
  return { comparing, selected, start: () => setComparing(true), exit, toggle, open };
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
  const compare = useCompareSelection();
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
          <CompareCheckbox key={item.id} item={item} selected={selected} onToggle={onToggle} />
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

interface CompareCheckboxProps {
  readonly item: SavedHotelView;
  readonly selected: readonly string[];
  readonly onToggle: (hotelId: string) => void;
}

/** A saved hotel as a compare pick: checked when selected, disabled once the maximum is chosen. */
function CompareCheckbox({ item, selected, onToggle }: CompareCheckboxProps) {
  const checked = selected.includes(item.hotel.id);
  return (
    <Checkbox
      label={item.hotel.name}
      description={destinationLabel(item.hotel.destination)}
      checked={checked}
      onCheckedChange={() => onToggle(item.hotel.id)}
      disabled={!checked && selected.length >= HOTEL_COMPARE_MAX}
      testID={`compare-select-${item.hotel.id}`}
      className="border-t border-primary/16 py-3"
    />
  );
}

/** The compare picker's footer: how many are chosen, the cap once it is reached, and the action (2–4 only). */
function CompareBar({
  count,
  onCompare,
}: {
  readonly count: number;
  readonly onCompare: () => void;
}) {
  const ready = count >= HOTEL_COMPARE_MIN && count <= HOTEL_COMPARE_MAX;
  const atMax = count >= HOTEL_COMPARE_MAX;
  const message =
    count === 0
      ? `Pick ${HOTEL_COMPARE_MIN}–${HOTEL_COMPARE_MAX} hotels to compare`
      : atMax
        ? `Maximum ${HOTEL_COMPARE_MAX} — uncheck one to swap`
        : `${count} selected`;
  useAnnounce(atMax ? message : undefined, atMax, { web: true });
  return (
    <Row gap={3} justify="between" align="center" className="border-t border-primary/16 pt-3">
      <Text variant="caption" tone="muted" className="shrink" {...politeLiveRegion()}>
        {message}
      </Text>
      <Button variant="primary" size="sm" disabled={!ready} onPress={onCompare}>
        Compare
      </Button>
    </Row>
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
