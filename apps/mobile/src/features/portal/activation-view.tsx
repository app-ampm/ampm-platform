import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import type { MeResponse } from "@ampm/core";
import { Callout, Screen, ScreenHeader } from "@ampm/ui";

import { ActivationSteps } from "./activation-steps";
import { EnquiriesPanel } from "./enquiries-panel";
import { PlanList } from "./plan-list";
import { canBrowseHotels, greeting, hasHotelAssistance } from "./portal.format";

export interface ActivationViewProps {
  readonly me: MeResponse;
  readonly tabBar?: ReactNode;
}

/**
 * Before hotel discovery is active (CP-11, D2): where the client stands, the plans with their payment
 * and, for a client who already holds them, the hotels in reach and the hotel requests.
 */
export function ActivationView({ me, tabBar }: ActivationViewProps) {
  const router = useRouter();
  return (
    <Screen
      width="content"
      tabBar={tabBar}
      header={
        <ScreenHeader eyebrow={greeting(me.principal.name)} title="Activate hotel discovery" />
      }
    >
      <ActivationSteps />
      {canBrowseHotels(me) ? (
        // A demo, project or agreement principal reaches its own scoped set without a full subscription.
        <Callout
          kind="indicative"
          title="Explore the hotels available to you"
          action={{ label: "Browse hotels", onPress: () => router.push("/hotels") }}
        />
      ) : null}
      <PlanList />
      {hasHotelAssistance(me) ? <EnquiriesPanel /> : null}
    </Screen>
  );
}
