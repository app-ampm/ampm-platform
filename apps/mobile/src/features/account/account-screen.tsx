import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useMe } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import {
  Avatar,
  EmptyState,
  ErrorState,
  OfflineState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { SignOutButton } from "@/navigation/sign-out-button";

import { AccountDetails } from "./account-details";

export interface AccountScreenProps {
  /** The app's tab bar on a phone (the route passes `<AppTabBar />`); this screen is More. */
  readonly tabBar?: ReactNode;
}

/**
 * More (P10, M10): `/me` with the shared states (standards §2.7 step 5): loading, signed out,
 * offline, error, and the principal with roles, memberships and entitlements, the app's other
 * pages, and sign-out.
 */
export function AccountScreen({ tabBar }: AccountScreenProps) {
  const me = useMe();
  const avatar = me.data ? <Avatar name={me.data.principal.name} tone="highlight" /> : undefined;
  return (
    <Screen
      width="content"
      tabBar={tabBar}
      header={<ScreenHeader title="More" trailing={avatar} />}
    >
      {me.isPending ? (
        <AccountLoading />
      ) : me.isError ? (
        <AccountError error={me.error} onRetry={() => void me.refetch()} />
      ) : (
        <AccountDetails me={me.data} />
      )}
    </Screen>
  );
}

function AccountLoading() {
  return (
    <Stack gap={3} testID="account-loading">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton shape="text" className="w-48" />
    </Stack>
  );
}

/**
 * `/me` failed: offline, signed out (with the way back to sign-in), or any other failure with a retry
 * and sign-out. Without `/me` the navigation shows only this screen's tab, so sign-out stays in reach
 * when the account cannot be read (a server error, an account the API no longer resolves).
 */
function AccountError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const router = useRouter();
  if (isAppError(error) && error.code === "network_error")
    return <OfflineState onRetry={onRetry} />;
  if (isAppError(error) && error.code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title="Sign in to see your account"
        description="Development builds sign in with a seeded account."
        action={{ label: "Sign in", variant: "primary", onPress: () => router.replace("/sign-in") }}
      />
    );
  }
  return (
    <>
      <ErrorState onRetry={onRetry} />
      <SignOutButton />
    </>
  );
}
