import { useRouter } from "expo-router";

import { useCompare } from "@ampm/api-client";
import { HOTEL_COMPARE_MAX, HOTEL_COMPARE_MIN } from "@ampm/core";
import { EmptyState, QueryErrorState, Screen, ScreenHeader, Skeleton, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelCompareTable } from "./hotel-compare-table";
import { DISCOVERY_SIGN_IN } from "./hotels.format";

export interface CompareScreenProps {
  /** The hotel ids to compare, from the shortlist's compare selection (the route's `ids` query). */
  readonly ids: readonly string[];
}

/**
 * Compare 2–4 saved hotels side by side (CP-06, feature 9.4c). The ids come from the shortlist's compare
 * selection; the server returns only those still on the shortlist and in reach, so the result can hold
 * fewer — if fewer than two survive there is nothing to compare, and the screen points back.
 */
export function CompareScreen({ ids }: CompareScreenProps) {
  const router = useRouter();
  const onBack = () => router.back();
  return (
    <Screen
      glow="top"
      width="content"
      header={<ScreenHeader eyebrow="Saved hotels" title="Compare" onBack={onBack} />}
    >
      <CompareBody ids={ids} onBack={onBack} />
    </Screen>
  );
}

interface CompareBodyProps {
  readonly ids: readonly string[];
  readonly onBack: () => void;
}

function CompareBody({ ids, onBack }: CompareBodyProps) {
  const compare = useCompare(ids);
  const goToSignIn = useGoToSignIn();
  const backToShortlist = {
    label: "Back to shortlist",
    variant: "primary" as const,
    onPress: onBack,
  };
  // The hook only runs for a 2–4 selection; outside that range it never resolves, so guard both bounds.
  if (ids.length < HOTEL_COMPARE_MIN || ids.length > HOTEL_COMPARE_MAX)
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
  return <HotelCompareTable items={compare.data.items} />;
}

function CompareLoading() {
  return (
    <Stack gap={3} testID="compare-loading">
      <Skeleton className="h-48 w-full rounded-lg" />
    </Stack>
  );
}
