import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Text } from "./text";

export const stories = defineStories({
  title: "Text",
  stories: [
    {
      name: "Variants",
      render: () => (
        <Stack gap={2}>
          <Text variant="display">Display</Text>
          <Text variant="title">Title</Text>
          <Text variant="heading">Heading</Text>
          <Text variant="subheading">Subheading</Text>
          <Text>Body: the wedding of Priya and Arjun, 14 February 2027.</Text>
          <Text variant="bodySmall">Body small</Text>
          <Text variant="caption">Caption</Text>
          <Text variant="label">Label</Text>
          <Text variant="mono">mono: AMPM-2027-0142</Text>
        </Stack>
      ),
    },
    {
      name: "Tones",
      render: () => (
        <Stack gap={1}>
          <Text>Primary</Text>
          <Text tone="muted">Muted</Text>
          <Text tone="brand">Brand</Text>
          <Text tone="success">Success</Text>
          <Text tone="warning">Warning</Text>
          <Text tone="danger">Danger</Text>
          <Text tone="info">Info</Text>
        </Stack>
      ),
    },
    {
      name: "Weights",
      render: () => (
        <Stack gap={1}>
          <Text weight="normal">Normal 400</Text>
          <Text weight="medium">Medium 500</Text>
          <Text weight="semibold">Semibold 600</Text>
          <Text weight="bold">Bold 700</Text>
        </Stack>
      ),
    },
  ],
});
