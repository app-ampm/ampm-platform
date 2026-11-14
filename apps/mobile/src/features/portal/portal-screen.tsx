import type { ReactNode } from "react";

import { useMe } from "@ampm/api-client";
import { QueryErrorState, Screen, ScreenHeader } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { SignOutButton } from "@/navigation/sign-out-button";

import { ActivationView } from "./activation-view";
import { PortalLoading } from "./portal-loading";
import { isDiscoveryActive } from "./portal.format";
import { SubscriberHome } from "./subscriber-home";

export interface PortalScreenProps {
  /** The app's tab bar (the route passes it); Screen floats it over the content. */
  readonly tabBar?: ReactNode;
}

/**
 * The client portal home, `/portal`. Until the subscription reaches every hotel it is the activation
 * and payment page (CP-11, D2); then it is the subscriber home (CP-01, D4 and P2). `/me` decides which,
 * so it loads, fails (offline, signed out, error) and retries before either page shows. While any
 * other failure keeps `/me` unread, sign-out stays in reach under the error: the navigation has no
 * person to show.
 */
export function PortalScreen({ tabBar }: PortalScreenProps) {
  const me = useMe();
  const goToSignIn = useGoToSignIn();
  if (me.isPending) {
    return (
      <Screen width="wide" tabBar={tabBar}>
        <PortalLoading />
      </Screen>
    );
  }
  if (me.isError) {
    return (
      <Screen width="wide" tabBar={tabBar} header={<ScreenHeader title="Your plan" />}>
        <QueryErrorState
          error={me.error}
          onRetry={() => void me.refetch()}
          onSignIn={goToSignIn}
          signIn={{ title: "Sign in to view your plan" }}
          errorFooter={<SignOutButton />}
        />
      </Screen>
    );
  }
  return isDiscoveryActive(me.data) ? (
    <SubscriberHome me={me.data} tabBar={tabBar} />
  ) : (
    <ActivationView me={me.data} tabBar={tabBar} />
  );
}
