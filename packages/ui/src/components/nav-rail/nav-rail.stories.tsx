import { useState } from "react";
import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { NavRail } from "./nav-rail";
import type { NavRailItem } from "./nav-rail-item";

/** The nine areas of the admin workspace, with the T1 rail's counts and one needs-you badge. */
const AREAS: NavRailItem[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "leads", label: "Leads & Clients", icon: "users", count: 24 },
  { key: "hotels", label: "Hotels", icon: "hotel", count: 200 },
  { key: "weddings", label: "Weddings", icon: "heart", count: 18 },
  { key: "guests", label: "Guests", icon: "users-round" },
  { key: "vendors", label: "Vendors", icon: "store" },
  { key: "tasks", label: "Tasks & Operations", icon: "list-checks", count: 12 },
  { key: "finance", label: "Finance & Reports", icon: "chart" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const WITH_BADGE: NavRailItem[] = AREAS.map((area) =>
  area.key === "weddings" ? { ...area, count: undefined, badge: 2 } : area,
);

const noop = () => undefined;

function Person({ compact }: { compact: boolean }) {
  return (
    <Row gap={2}>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-highlight">
        <Text variant="caption" weight="bold" tone="onHighlight">
          EM
        </Text>
      </View>
      {compact ? null : (
        <Stack gap={0}>
          <Text variant="label">Eva M.</Text>
          <Text variant="caption">Super Admin</Text>
        </Stack>
      )}
    </Row>
  );
}

/** Press the chevron to collapse the rail to icons and back. */
function CollapsibleRail() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <NavRail
      items={WITH_BADGE}
      activeKey="weddings"
      onSelect={noop}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      header={<Text variant="wordmark">{collapsed ? "A" : "AMPM"}</Text>}
      footer={<Person compact={collapsed} />}
      className="m-0"
    />
  );
}

export const stories = defineStories({
  title: "Navigation rail",
  stories: [
    {
      name: "Expanded: the T1 rail",
      render: () => (
        <NavRail
          items={AREAS}
          activeKey="home"
          onSelect={noop}
          header={<Text variant="wordmark">AMPM</Text>}
          footer={<Person compact={false} />}
          className="m-0"
        />
      ),
    },
    {
      name: "A needs-you badge and a collapse toggle",
      render: () => <CollapsibleRail />,
    },
    {
      name: "Collapsed: icons only (768–1199)",
      render: () => (
        <NavRail
          items={WITH_BADGE}
          activeKey="hotels"
          onSelect={noop}
          collapsed
          onToggleCollapsed={noop}
          header={<Text variant="wordmark">A</Text>}
          footer={<Person compact />}
          className="m-0"
        />
      ),
    },
  ],
});
