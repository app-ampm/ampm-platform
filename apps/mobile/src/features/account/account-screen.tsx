import type { ReactNode } from "react";

import { useMe } from "@ampm/api-client";
import {
  Avatar,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  type QueryErrorSignIn,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { SignOutButton } from "@/navigation/sign-out-button";

import { AccountDetails } from "./account-details";

export interface AccountScreenProps {
  /** The app's tab bar on a phone (the route passes `<AppTabBar />`); this screen is More. */
  readonly tabBar?: ReactNode;
}

const SIGN_IN: QueryErrorSignIn = {
  title: "Sign in to see your account",
  description: "Development builds sign in with a seeded account.",
};

/**
 * More (P10, M10): `/me` with the shared states (standards §2.7 step 5): loading, signed out,
 * offline, error, and the principal with roles, memberships and entitlements, the app's other
 * pages, and sign-out. Without `/me` the navigation shows only this screen's tab, so sign-out stays
 * in reach under the error when the account cannot be read (a server error, an account the API no
 * longer resolves).
 */
export function AccountScreen({ tabBar }: AccountScreenProps) {
  const me = useMe();
  const goToSignIn = useGoToSignIn();
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
        <QueryErrorState
          error={me.error}
          onRetry={() => void me.refetch()}
          onSignIn={goToSignIn}
          signIn={SIGN_IN}
          errorFooter={<SignOutButton />}
        />
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
