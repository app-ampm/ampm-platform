import type { ReactNode } from "react";

import { useMe } from "@ampm/api-client";
import { Screen, ScreenHeader } from "@ampm/ui";

import { ActivationView } from "./activation-view";
import { PortalLoading } from "./portal-loading";
import { PortalMeError } from "./portal-me-error";
import { isDiscoveryActive } from "./portal.format";
import { SubscriberHome } from "./subscriber-home";

export interface PortalScreenProps {
  /** The app's tab bar (the route passes it); Screen floats it over the content. */
  readonly tabBar?: ReactNode;
}

/**
 * The client portal home, `/portal`. Until the subscription reaches every hotel it is the activation
 * and payment page (CP-11, D2); then it is the subscriber home (CP-01, D4 and P2). `/me` decides which,
 * so it loads, fails (offline, signed out, error) and retries before either page shows.
 */
export function PortalScreen({ tabBar }: PortalScreenProps) {
  const me = useMe();
  if (me.isPending) {
    return (
      <Screen width="content" tabBar={tabBar}>
        <PortalLoading />
      </Screen>
    );
  }
  if (me.isError) {
    return (
      <Screen width="content" tabBar={tabBar} header={<ScreenHeader title="Your plan" />}>
        <PortalMeError error={me.error} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }
  return isDiscoveryActive(me.data) ? (
    <SubscriberHome me={me.data} tabBar={tabBar} />
  ) : (
    <ActivationView me={me.data} tabBar={tabBar} />
  );
}
