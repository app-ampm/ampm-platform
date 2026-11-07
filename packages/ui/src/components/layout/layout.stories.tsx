import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Text } from "../text";
import { Divider } from "./divider";
import { Row } from "./row";
import { Spacer } from "./spacer";
import { Stack } from "./stack";

const Block = ({ label }: { label: string }) => (
  <View className="rounded border border-primary/12 bg-primary/6 px-3 py-2">
    <Text variant="label">{label}</Text>
  </View>
);

export const stories = defineStories({
  title: "Layout",
  stories: [
    {
      name: "Stack gap 2 and 4",
      render: () => (
        <Row gap={6} align="start">
          <Stack gap={2}>
            <Block label="one" />
            <Block label="two" />
          </Stack>
          <Stack gap={4}>
            <Block label="one" />
            <Block label="two" />
          </Stack>
        </Row>
      ),
    },
    {
      name: "Half steps 1.5, 2.5, 3.5, 4.5",
      render: () => (
        <Stack gap={3}>
          {([1.5, 2.5, 3.5, 4.5] as const).map((gap) => (
            <Row key={gap} gap={gap}>
              <Block label={`gap ${gap}`} />
              <Block label="b" />
              <Block label="c" />
            </Row>
          ))}
        </Stack>
      ),
    },
    {
      name: "Row with Spacer",
      render: () => (
        <Row>
          <Block label="start" />
          <Spacer />
          <Block label="end" />
        </Row>
      ),
    },
    {
      name: "Row wrap",
      render: () => (
        <Row wrap gap={2}>
          {["a", "b", "c", "d", "e", "f", "g", "h"].map((label) => (
            <Block key={label} label={label} />
          ))}
        </Row>
      ),
    },
    {
      name: "Divider: horizontal, inset and vertical",
      render: () => (
        <Stack gap={3}>
          <Text variant="label">Rooms</Text>
          <Divider />
          <Text variant="label">Venues</Text>
          <Divider inset />
          <Row gap={3}>
            <Text variant="data">UDAIPUR</Text>
            <Divider orientation="vertical" />
            <Text variant="data">12–14 FEB 2027</Text>
            <Divider orientation="vertical" />
            <Text variant="data">300 GUESTS</Text>
          </Row>
        </Stack>
      ),
    },
  ],
});
