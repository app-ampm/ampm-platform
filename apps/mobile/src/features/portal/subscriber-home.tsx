import type { ReactNode } from "react";

import type { MeResponse } from "@ampm/core";
import { Avatar, Columns, Screen, ScreenHeader, useLayoutAt } from "@ampm/ui";

import { useWindowClass } from "@/navigation/use-window-class";

import { DestinationChips } from "./destination-chips";
import { DiscoveryStatusCard } from "./discovery-status-card";
import { EnquiriesPanel } from "./enquiries-panel";
import { EnquiriesPreview } from "./enquiries-preview";
import { HomeSearchCard } from "./home-search-card";
import { HotelSearchEntry } from "./hotel-search-entry";
import { greeting, hasHotelAssistance } from "./portal.format";
import { SavedPreview } from "./saved-preview";
import { WeddingLockedCard } from "./wedding-locked-card";

export interface SubscriberHomeProps {
  readonly me: MeResponse;
  readonly tabBar?: ReactNode;
}

/**
 * The greeting and title, with the client's avatar at the right on a phone (P2). On the windows where
 * the app's top navigation carries the avatar (D4, `useWindowClass().isWide`), the header leaves it out.
 */
function HomeHeader({ name }: { readonly name: string }) {
  const { isWide } = useWindowClass();
  const showAvatar = !isWide && name.trim() !== "";
  return (
    <ScreenHeader
      eyebrow={greeting(name)}
      title="Find your venue"
      trailing={showAvatar ? <Avatar name={name} tone="highlight" /> : undefined}
    />
  );
}

/** D4's first row: the greeting, title and search on one glass card beside the plan, equal heights. */
function DesktopSearchRow({ name }: { readonly name: string }) {
  return (
    <Columns ratios={[1.5, 1]} testID="home-search-row">
      <HomeSearchCard name={name} className="flex-1" />
      <DiscoveryStatusCard className="flex-1 justify-between lg:px-9 lg:py-8" />
    </Columns>
  );
}

/**
 * Once hotel discovery is active (CP-01, P2 on a phone, D4 on a desktop): the plan's status, the
 * search, the shortlist, the hotel requests and the wedding areas that stay locked. Phones and tablets
 * stack them as P2 draws them: the header, the plan, the search pill, then the panels. From 1024 the
 * page is D4: the search card beside the plan (1.5 : 1), then My selection, the latest enquiries and
 * the locked card (1 : 1 : 0.9). Without hotel assistance there is no enquiries column, and the other
 * two line up under the first row.
 */
export function SubscriberHome({ me, tabBar }: SubscriberHomeProps) {
  const isDesktop = useLayoutAt("lg");
  const name = me.principal.name;
  const assisted = hasHotelAssistance(me);
  const enquiries = isDesktop ? <EnquiriesPreview className="flex-1" /> : <EnquiriesPanel />;
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={isDesktop ? undefined : <HomeHeader name={name} />}
    >
      {isDesktop ? <DesktopSearchRow name={name} /> : <DiscoveryStatusCard />}
      {isDesktop ? null : <HotelSearchEntry />}
      <DestinationChips />
      {/* D4's 18 between the panels; stacked, the screen's own 16. */}
      <Columns
        ratios={assisted ? [1, 1, 0.9] : [1.5, 1]}
        gap={isDesktop ? 4.5 : 4}
        testID="home-panels"
      >
        <SavedPreview className="lg:flex-1" />
        {assisted ? enquiries : null}
        <WeddingLockedCard className="lg:flex-1" />
      </Columns>
    </Screen>
  );
}
