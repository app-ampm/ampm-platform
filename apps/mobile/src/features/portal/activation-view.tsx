import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import type { MeResponse } from "@ampm/core";
import { Callout, Columns, Screen, ScreenHeader, Stack, useLayoutAt } from "@ampm/ui";

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
 * and, for a client who already holds them, the hotels in reach and the hotel requests. From 1024 the
 * page is D2's two columns (1 : 1.1): the header, steps and notices beside the payment card. D2's "Your
 * wedding" panel waits for wedding details on `/me`. A phone keeps the requests under the plans, so
 * they join the left column only when the columns stand side by side.
 */
export function ActivationView({ me, tabBar }: ActivationViewProps) {
  const isDesktop = useLayoutAt("lg");
  const enquiries = hasHotelAssistance(me) ? <EnquiriesPanel /> : null;
  return (
    <Screen width="wide" tabBar={tabBar}>
      {/* D2's 24 between the columns; stacked, the screen's own 16 between panels. */}
      <Columns ratios={[1, 1.1]} gap={isDesktop ? 6 : 4} testID="activation-columns">
        <Stack gap={4}>
          <ScreenHeader eyebrow={greeting(me.principal.name)} title="Activate hotel discovery" />
          <ActivationSteps />
          <BrowseCallout me={me} />
          {isDesktop ? enquiries : null}
        </Stack>
        <PlanList />
      </Columns>
      {isDesktop ? null : enquiries}
    </Screen>
  );
}

/** A demo, project or agreement principal reaches its own scoped set without a full subscription. */
function BrowseCallout({ me }: { readonly me: MeResponse }) {
  const router = useRouter();
  if (!canBrowseHotels(me)) return null;
  return (
    <Callout
      kind="indicative"
      title="Explore the hotels available to you"
      action={{ label: "Browse hotels", onPress: () => router.push("/hotels") }}
    />
  );
}
