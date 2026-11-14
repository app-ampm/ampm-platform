import { useRouter } from "expo-router";

import { useCompare, useSavedHotels } from "@ampm/api-client";
import { HOTEL_COMPARE_MAX, HOTEL_COMPARE_MIN, type HotelCompareItem } from "@ampm/core";
import { Card, EmptyState, QueryErrorState, Screen, ScreenHeader, Skeleton, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelCompareTable } from "./hotel-compare-table";
import { DISCOVERY_SIGN_IN, hotelCountLabel } from "./hotels.format";

export interface CompareScreenProps {
  /** The hotel ids to compare, from the shortlist's compare selection (the route's `ids` query). */
  readonly ids: readonly string[];
}

type CompareQuery = ReturnType<typeof useCompare>;

/** The hook only runs for a 2–4 selection; outside that range it never resolves, so both bounds are guarded. */
function inCompareRange(ids: readonly string[]): boolean {
  return ids.length >= HOTEL_COMPARE_MIN && ids.length <= HOTEL_COMPARE_MAX;
}

/**
 * Compare 2–4 saved hotels side by side (CP-06, feature 9.4c; D7 "Side by side"). The ids come from the
 * shortlist's compare selection; the server returns only those still on the shortlist and in reach, so the
 * result can hold fewer — if fewer than two survive there is nothing to compare, and the screen points back.
 * A desktop artboard page (`wide`): the display title over one glass card holding the table.
 */
export function CompareScreen({ ids }: CompareScreenProps) {
  const router = useRouter();
  const onBack = () => router.back();
  const compare = useCompare(ids);
  const count = compare.data?.items.length ?? (inCompareRange(ids) ? ids.length : 0);
  return (
    <Screen
      glow="top"
      width="wide"
      header={
        <ScreenHeader
          size="display"
          // D7's 53px title on a desktop; a phone keeps its 36.
          titleClassName="text-4xl lg:text-6xl"
          eyebrow={count > 0 ? `My selection · ${hotelCountLabel(count, false)}` : "My selection"}
          title="Side by side"
          onBack={onBack}
        />
      }
    >
      <CompareBody ids={ids} compare={compare} onBack={onBack} />
    </Screen>
  );
}

interface CompareBodyProps {
  readonly ids: readonly string[];
  readonly compare: CompareQuery;
  readonly onBack: () => void;
}

function CompareBody({ ids, compare, onBack }: CompareBodyProps) {
  const goToSignIn = useGoToSignIn();
  const backToShortlist = {
    label: "Back to shortlist",
    variant: "primary" as const,
    onPress: onBack,
  };
  if (!inCompareRange(ids))
    return (
      <EmptyState
        icon="inbox"
        title={`Pick ${HOTEL_COMPARE_MIN} to ${HOTEL_COMPARE_MAX} hotels`}
        description="Choose a few saved hotels to compare them side by side."
        action={backToShortlist}
      />
    );
  if (compare.isPending) return <CompareLoading />;
  if (compare.isError)
    return (
      <QueryErrorState
        error={compare.error}
        onRetry={() => void compare.refetch()}
        onSignIn={goToSignIn}
        signIn={DISCOVERY_SIGN_IN}
      />
    );
  if (compare.data.items.length < HOTEL_COMPARE_MIN)
    return (
      <EmptyState
        icon="inbox"
        title="Couldn't compare these hotels"
        description="They may no longer be on your shortlist."
        action={backToShortlist}
      />
    );
  return <CompareCard items={compare.data.items} />;
}

/**
 * The table in D7's one glass card. The compare read carries no media, but every compared hotel is on the
 * shortlist, whose rows do carry a cover: the headings borrow those (usually already cached by the time
 * the shortlist opens the compare), and keep the stand-in when there is none.
 */
function CompareCard({ items }: { readonly items: readonly HotelCompareItem[] }) {
  const saved = useSavedHotels();
  const covers = new Map(
    saved.items.flatMap((entry) =>
      entry.hotel.coverUrl ? [[entry.hotel.id, entry.hotel.coverUrl] as const] : [],
    ),
  );
  return (
    <Card padding="sm" className="md:px-6 lg:px-8 lg:pb-6 lg:pt-3" testID="compare-card">
      <HotelCompareTable items={items} covers={covers} />
    </Card>
  );
}

function CompareLoading() {
  return (
    <Stack gap={3} testID="compare-loading">
      <Skeleton className="h-48 w-full rounded-lg" />
    </Stack>
  );
}
