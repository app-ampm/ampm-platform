import type { ReactNode } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import type { MeResponse } from "@ampm/core";
import { Avatar, Screen, ScreenHeader } from "@ampm/ui";

import { useWindowClass } from "@/navigation/use-window-class";

import { DiscoveryStatusCard } from "./discovery-status-card";
import { EnquiriesPanel } from "./enquiries-panel";
import { EntryPanel } from "./entry-panel";
import { HotelSearchEntry } from "./hotel-search-entry";
import { greeting, hasHotelAssistance } from "./portal.format";
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

/**
 * Once hotel discovery is active (CP-01, P2 on a phone, D4 on a desktop): the plan's status, the
 * search, the shortlist, the hotel requests and the wedding areas that stay locked. Phones and
 * tablets stack the panels as P2 draws them; from 1024 the search sits beside the status (the status
 * first for screen readers, as on a phone) and the three panels stand side by side, as in D4.
 */
export function SubscriberHome({ me, tabBar }: SubscriberHomeProps) {
  const router = useRouter();
  return (
    <Screen width="wide" tabBar={tabBar} header={<HomeHeader name={me.principal.name} />}>
      <View className="gap-4 lg:flex-row-reverse lg:items-center">
        <DiscoveryStatusCard className="lg:w-96" />
        <HotelSearchEntry className="lg:flex-1" />
      </View>
      <View className="gap-4 lg:flex-row lg:items-stretch">
        <EntryPanel
          heading="My selection"
          title="Saved hotels"
          subtitle="The hotels on your shortlist."
          icon="heart"
          onPress={() => router.push("/hotels/saved")}
          className="lg:flex-1"
        />
        {hasHotelAssistance(me) ? <EnquiriesPanel className="lg:flex-1" /> : null}
        <WeddingLockedCard className="lg:flex-1" />
      </View>
    </Screen>
  );
}
