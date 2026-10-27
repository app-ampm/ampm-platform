import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Text } from "../text";
import { Row } from "./row";
import { Spacer } from "./spacer";
import { Stack } from "./stack";

const Block = ({ label }: { label: string }) => (
  <View className="rounded bg-brand-soft px-3 py-2">
    <Text variant="label" tone="brand">
      {label}
    </Text>
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
  ],
});
