import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Icon } from "../icon";
import { Row } from "../layout";
import { Text } from "../text";
import { Badge } from "./badge";

export const stories = defineStories({
  title: "Badge",
  stories: [
    {
      name: "Counts",
      description: "Gold with midnight numerals; past 99 it reads 99+.",
      render: () => (
        <Row gap={2} wrap>
          <Badge count={1} />
          <Badge count={2} />
          <Badge count={12} />
          <Badge count={99} />
          <Badge count={128} />
          <Badge count={1200} max={999} />
        </Row>
      ),
    },
    {
      name: "Tones and words",
      description: "Peacock for a highlight; a word instead of a number.",
      render: () => (
        <Row gap={2} wrap>
          <Badge count={4} />
          <Badge count={4} tone="highlight" />
          <Badge label="New" />
          <Badge label="New" tone="highlight" />
        </Row>
      ),
    },
    {
      name: "In navigation",
      description: "Approvals 2 in the tab bar and the rail; a zero count shows nothing.",
      render: () => (
        <GlassPanel className="rounded-full px-5 py-3">
          <Row gap={6} wrap>
            <Row gap={2}>
              <Text variant="label" tone="body">
                Approvals
              </Text>
              <Badge count={2} accessibilityLabel="2 waiting" className="self-center" />
            </Row>
            <Row gap={2}>
              <Text variant="label" tone="body">
                Waiting on you
              </Text>
              <Badge count={4} className="self-center" />
            </Row>
            <Row gap={2}>
              <Text variant="label" tone="body">
                Enquiries
              </Text>
              <Badge count={0} className="self-center" />
            </Row>
          </Row>
        </GlassPanel>
      ),
    },
    {
      name: "On an icon",
      description: "Pinned to the corner of an icon in a compact bar.",
      render: () => (
        <View className="relative self-start p-2">
          <Icon name="bell" size="lg" label="Notifications" />
          {/* Absolute: the badge overlaps the icon's corner without moving it. */}
          <Badge count={3} accessibilityLabel="3 unread" className="absolute right-0 top-0" />
        </View>
      ),
    },
  ],
});
