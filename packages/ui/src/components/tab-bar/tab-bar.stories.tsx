import { useState } from "react";
import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Text } from "../text";
import { TabBar } from "./tab-bar";
import type { TabBarItem } from "./tab-bar-item";

const SUBSCRIBER: TabBarItem[] = [
  { key: "home", label: "Home" },
  { key: "hotels", label: "Hotels" },
  { key: "wedding", label: "Wedding", locked: true },
  { key: "approvals", label: "Approvals", locked: true },
  { key: "more", label: "More" },
];

const APPOINTED: TabBarItem[] = [
  { key: "home", label: "Home" },
  { key: "hotels", label: "Hotels" },
  { key: "wedding", label: "Wedding" },
  { key: "approvals", label: "Approvals", badge: 2 },
  { key: "more", label: "More" },
];

const TEAM: TabBarItem[] = [
  { key: "home", label: "Home" },
  { key: "weddings", label: "Weddings" },
  { key: "tasks", label: "Tasks" },
  { key: "more", label: "More" },
];

const TEAM_ICONS: TabBarItem[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "weddings", label: "Weddings", icon: "heart" },
  { key: "tasks", label: "Tasks", icon: "list-checks", badge: 3 },
  { key: "more", label: "More", icon: "more" },
];

const noop = () => undefined;

/** Press the tabs to watch the peacock pill slide (it jumps under reduced motion). */
function InteractiveTabBar() {
  const [active, setActive] = useState("home");
  return (
    <View className="gap-3">
      <TabBar items={APPOINTED} activeKey={active} onSelect={setActive} floating={false} />
      <Text variant="caption">{`Showing: ${active}`}</Text>
    </View>
  );
}

export const stories = defineStories({
  title: "Tab bar",
  stories: [
    {
      name: "Client app: subscriber, Wedding and Approvals locked",
      render: () => <TabBar items={SUBSCRIBER} activeKey="home" onSelect={noop} floating={false} />,
    },
    {
      name: "Client app: appointed, two approvals waiting",
      render: () => (
        <TabBar items={APPOINTED} activeKey="approvals" onSelect={noop} floating={false} />
      ),
    },
    {
      name: "Team app: four tabs",
      render: () => <TabBar items={TEAM} activeKey="weddings" onSelect={noop} floating={false} />,
    },
    {
      name: "With icons and a count",
      render: () => <TabBar items={TEAM_ICONS} activeKey="home" onSelect={noop} floating={false} />,
    },
    {
      name: "Interactive: the sliding pill",
      render: () => <InteractiveTabBar />,
    },
    {
      name: "Floating over a screen",
      render: () => (
        <View className="h-48 overflow-hidden rounded-lg bg-surface">
          <Text className="p-4">Screen content scrolls under the bar.</Text>
          <TabBar items={TEAM} activeKey="tasks" onSelect={noop} />
        </View>
      ),
    },
  ],
});
