import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useClientSavedHotels, type CursorListResult } from "@ampm/api-client";
import type { SavedHotelStaffView } from "@ampm/core";
import {
  EmptyState,
  LoadMore,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { ClientSavedHotelsTable } from "./client-saved-hotels-table";
import { savedHotelsCount } from "./saved-hotels.format";

interface BodyProps {
  readonly saved: CursorListResult<SavedHotelStaffView>;
  readonly onOpenClient: (accountId: string) => void;
}

function SavedLoading() {
  return (
    <Stack gap={2} testID="client-saved-hotels-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

function SavedBody({ saved, onOpenClient }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (saved.isPending) return <SavedLoading />;
  if (saved.isError) {
    return (
      <QueryErrorState
        error={saved.error}
        onRetry={saved.refetch}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view saved hotels",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (saved.items.length === 0) {
    return (
      <EmptyState
        icon="heart"
        title="No saved hotels yet"
        description="Hotels appear here as clients save them while exploring on their subscription."
      />
    );
  }
  return (
    <Stack gap={4}>
      <ClientSavedHotelsTable items={saved.items} onOpenClient={onOpenClient} />
      <LoadMore
        hasMore={saved.hasMore}
        loading={saved.isLoadingMore}
        failed={saved.loadMoreError}
        onLoadMore={saved.loadMore}
        testID="client-saved-hotels-load-more"
      />
    </Stack>
  );
}

export interface ClientSavedHotelsScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * Every client's saved hotels, newest first (permission-matrix §5.16 "Hotel shortlist" for SA, SM, HT):
 * what clients are interested in as they explore, across the whole book, so the team can follow up. Each
 * row opens the client's hub, where their whole list sits beside their enquiries. Reached from the
 * Clients list; the server refuses a role without `hotels.saved_hotels.read`.
 *
 *   <ClientSavedHotelsScreen tabBar={<AppTabBar />} />
 */
export function ClientSavedHotelsScreen({ tabBar }: ClientSavedHotelsScreenProps) {
  const router = useRouter();
  const saved = useClientSavedHotels();
  const openClient = (accountId: string): void =>
    router.push({ pathname: "/leads/accounts/[accountId]", params: { accountId } });
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={
            saved.isPending
              ? "Hotels saved"
              : savedHotelsCount("Hotels saved", saved.items.length, saved.hasMore)
          }
          title="Saved hotels"
          subtitle="What each client has saved while exploring hotels, newest first."
          onBack={() => router.back()}
        />
      }
    >
      <SavedBody saved={saved} onOpenClient={openClient} />
    </Screen>
  );
}
