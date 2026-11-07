import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { defineStories } from "../../stories/define";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { GlassPanel } from "../glass-panel";
import { Row, Stack } from "../layout";
import { ScreenHeader } from "../screen-header";
import { Stat } from "../stat";
import { TabBar } from "../tab-bar";
import { Text } from "../text";
import { Screen } from "./screen";
import { SAMPLE_AMOUNTS } from "../../stories/fixtures/sample-amounts";

const noop = () => undefined;

// A story frame is not a device: no notch, no home indicator.
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={NO_INSETS}>
      <View className="h-96 overflow-hidden rounded-2xl border border-primary/16">{children}</View>
    </SafeAreaInsetsContext.Provider>
  );
}

const TABS = [
  { key: "home", label: "Home" },
  { key: "hotels", label: "Hotels" },
  { key: "wedding", label: "My Wedding", locked: true },
  { key: "approvals", label: "Approvals", locked: true },
  { key: "more", label: "More" },
];

function Panel({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <GlassPanel className="gap-1 p-4">
      <Text variant="label">{title}</Text>
      <Text variant="bodySmall">{detail}</Text>
    </GlassPanel>
  );
}

function SubscriberHome() {
  return (
    <Frame>
      <Screen
        header={
          <ScreenHeader
            eyebrow="Hello, Ananya"
            title="Find your venue"
            trailing={<Avatar name="Ananya Sharma" tone="highlight" />}
          />
        }
        tabBar={<TabBar items={TABS} activeKey="home" onSelect={noop} />}
      >
        <GlassPanel recipe="peacock" className="p-5">
          <Stat
            label="Hotel discovery"
            value={18}
            caption="days left · until 5 Dec"
            detailTone="body"
          />
        </GlassPanel>
        <Panel title="My selection" detail="Raj Niwas Palace · Udaipur" />
        <Panel title="Planning the whole wedding?" detail="Wedding and Approvals open later." />
      </Screen>
    </Frame>
  );
}

function PriceBar() {
  return (
    <Row justify="between" gap={3}>
      <Stack gap={0}>
        <Text variant="data">{SAMPLE_AMOUNTS.roomRange}</Text>
        <Text variant="caption">per room / night</Text>
      </Stack>
      <Button>Check availability</Button>
    </Row>
  );
}

function HotelPage() {
  return (
    <Frame>
      <Screen
        glow="top"
        header={
          <ScreenHeader onBack={noop} eyebrow="Udaipur · Lake Pichola" title="Raj Niwas Palace" />
        }
        footer={<PriceBar />}
      >
        <Panel title="Rates" detail="Verified on 2 Nov 2026 by AMPM" />
        <Panel title="Package range" detail={SAMPLE_AMOUNTS.packageRange} />
        <Panel title="Venues" detail="Four, from 120 to 420 guests" />
      </Screen>
    </Frame>
  );
}

export const stories = defineStories({
  title: "Screen",
  stories: [
    {
      name: "Phone home with a floating tab bar (P2)",
      description: "Header in the gutter, glass panels 16 apart, room kept for the tab bar.",
      render: () => <SubscriberHome />,
    },
    {
      name: "Back, hero glow and a sticky price bar (P4)",
      render: () => <HotelPage />,
    },
    {
      name: "Not scrolling, centred glow (confirmation)",
      render: () => (
        <Frame>
          <Screen scroll={false} glow="center" contentClassName="justify-center">
            <ScreenHeader title="Request" emphasis="received." subtitle="AMPM will call you." />
          </Screen>
        </Frame>
      ),
    },
    {
      name: "Reading column on a desktop (width content)",
      render: () => (
        <Frame>
          <Screen width="content" glow="none" header={<ScreenHeader title="Settings" />}>
            <Panel title="Notifications" detail="Email and WhatsApp" />
          </Screen>
        </Frame>
      ),
    },
  ],
});
