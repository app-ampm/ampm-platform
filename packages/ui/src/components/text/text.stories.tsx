import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Text } from "./text";

export const stories = defineStories({
  title: "Text",
  stories: [
    {
      name: "Gilda Display: one weight",
      render: () => (
        <Stack gap={2}>
          <Text variant="display">Palaces</Text>
          <Text variant="title">Find your venue</Text>
          <Text variant="heading">Raj Niwas Palace</Text>
          <Text variant="wordmark">AMPM</Text>
          <Text variant="stat" tone="brand">
            18
          </Text>
        </Stack>
      ),
    },
    {
      name: "Manrope: interface and body",
      render: () => (
        <Stack gap={2}>
          <Text variant="eyebrow">Total discovery</Text>
          <Text variant="subheading">Subheading 16</Text>
          <Text>Body: the wedding of Priya and Arjun, 14 February 2027.</Text>
          <Text variant="bodySmall">Body small 13</Text>
          <Text variant="label">Label 13</Text>
          <Text variant="caption">Caption 11</Text>
          <Text variant="data">₹46,80,000 · 12–14 FEB 2027</Text>
        </Stack>
      ),
    },
    {
      name: "One word in gold",
      description: "At most one emphasised gold word in a heading; it stays part of the heading.",
      render: () => (
        <Text variant="title">
          Find your{" "}
          <Text variant="title" tone="brand" accessibilityRole="none">
            palace.
          </Text>
        </Text>
      ),
    },
    {
      name: "Pearl strengths and gold",
      render: () => (
        <Stack gap={1}>
          <Text tone="primary">Primary 100 · headings and values</Text>
          <Text tone="body">Body 80 · running text</Text>
          <Text tone="muted">Muted 58 · labels and metadata</Text>
          <Text tone="disabled">Disabled 45</Text>
          <Text tone="brand" weight="bold">
            Brand · the one action word
          </Text>
        </Stack>
      ),
    },
    {
      name: "On fills, and peacock at display size",
      description: "Small text on gold or peacock is midnight; peacock text only from 24 up.",
      render: () => (
        <Stack gap={2} align="start">
          <View className="rounded-full bg-brand px-4 py-2">
            <Text variant="label" tone="onBrand">
              Midnight on gold
            </Text>
          </View>
          <View className="rounded-full bg-highlight px-4 py-2">
            <Text variant="label" tone="onHighlight">
              Midnight on peacock
            </Text>
          </View>
          <Text variant="heading" tone="highlight">
            Verified
          </Text>
        </Stack>
      ),
    },
    {
      name: "Manrope weights",
      render: () => (
        <Stack gap={1}>
          <Text weight="normal">Normal 400</Text>
          <Text weight="medium">Medium 500</Text>
          <Text weight="semibold">Semibold 600</Text>
          <Text weight="bold">Bold 700</Text>
          <Text weight="extrabold">Extrabold 800</Text>
        </Stack>
      ),
    },
    {
      name: "Greeting: Rozha One",
      description: "Devanagari greetings only, never interface text.",
      render: () => (
        <Text variant="greeting" tone="brand">
          शुभ विवाह
        </Text>
      ),
    },
  ],
});
