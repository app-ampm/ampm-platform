import { View } from "react-native";

import { Row, Stack } from "../components/layout";
import { Text } from "../components/text";
import { defineStories } from "./define";

const Swatch = ({ className, label }: { className: string; label: string }) => (
  <Stack gap={1} align="center" className="w-20">
    <View className={`h-10 w-20 rounded border border-subtle ${className}`} />
    <Text variant="caption" tone="muted" numberOfLines={1}>
      {label}
    </Text>
  </Stack>
);

export const stories = defineStories({
  title: "Tokens",
  stories: [
    {
      name: "Surfaces and brand",
      render: () => (
        <Row gap={2} wrap>
          <Swatch className="bg-surface" label="surface" />
          <Swatch className="bg-surface-elevated" label="elevated" />
          <Swatch className="bg-surface-inset" label="inset" />
          <Swatch className="bg-brand" label="brand" />
          <Swatch className="bg-brand-soft" label="brand-soft" />
          <Swatch className="bg-overlay/50" label="overlay/50" />
        </Row>
      ),
    },
    {
      name: "Status",
      render: () => (
        <Row gap={2} wrap>
          <Swatch className="bg-success" label="success" />
          <Swatch className="bg-success-soft" label="success-soft" />
          <Swatch className="bg-warning" label="warning" />
          <Swatch className="bg-warning-soft" label="warning-soft" />
          <Swatch className="bg-danger" label="danger" />
          <Swatch className="bg-danger-soft" label="danger-soft" />
          <Swatch className="bg-info" label="info" />
          <Swatch className="bg-info-soft" label="info-soft" />
        </Row>
      ),
    },
    {
      name: "Radii and shadows",
      render: () => (
        <Row gap={3} wrap align="end">
          <View className="h-12 w-12 rounded-sm bg-surface-inset" />
          <View className="h-12 w-12 rounded bg-surface-inset" />
          <View className="h-12 w-12 rounded-lg bg-surface-inset" />
          <View className="h-12 w-12 rounded-xl bg-surface-inset" />
          <View className="h-12 w-12 rounded-full bg-surface-inset" />
          <View className="h-12 w-12 rounded bg-surface-elevated shadow-sm" />
          <View className="h-12 w-12 rounded bg-surface-elevated shadow-md" />
          <View className="h-12 w-12 rounded bg-surface-elevated shadow-lg" />
        </Row>
      ),
    },
  ],
});
