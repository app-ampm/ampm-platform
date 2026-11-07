import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { Button } from "./button";

export const stories = defineStories({
  title: "Button",
  stories: [
    {
      name: "Variants",
      description: "One gold primary per screen; peacock confirms; gold outline instead of red.",
      render: () => (
        <Row gap={2} wrap>
          <Button>Request a demo</Button>
          <Button variant="secondary">Explore palaces</Button>
          <Button variant="highlight">Approve version 3</Button>
          <Button variant="glass">View gallery</Button>
          <Button variant="ghost">Not now</Button>
          <Button variant="destructive">Remove hotel</Button>
        </Row>
      ),
    },
    {
      name: "Sizes",
      description: "13, 15 and 16 on a 44px minimum (48 for lg).",
      render: () => (
        <Stack gap={3}>
          <Row gap={2} wrap>
            <Button size="sm">Review</Button>
            <Button size="md">Request a demo</Button>
            <Button size="lg">Request a demo</Button>
          </Row>
          <Row gap={2} wrap>
            <Button variant="secondary" size="sm">
              Choose
            </Button>
            <Button variant="secondary" size="md">
              Explore palaces
            </Button>
            <Button variant="secondary" size="lg">
              Explore palaces
            </Button>
          </Row>
        </Stack>
      ),
    },
    {
      name: "With icons",
      render: () => (
        <Row gap={2} wrap>
          <Button icon="plus">New request</Button>
          <Button variant="secondary" iconEnd="arrow-right">
            Continue
          </Button>
          <Button variant="highlight" icon="check">
            Mark cue done
          </Button>
          <Button variant="ghost" size="sm" icon="arrow-left">
            Back
          </Button>
        </Row>
      ),
    },
    {
      name: "Icon only",
      description: "Circles: 44 for sm and md, 48 for lg. Always with accessibilityLabel.",
      render: () => (
        <Row gap={2} wrap>
          <Button icon="plus" accessibilityLabel="New request" />
          <Button variant="secondary" icon="sliders" accessibilityLabel="Filters" />
          <Button variant="highlight" icon="check" accessibilityLabel="Approve" />
          <Button variant="glass" icon="heart" accessibilityLabel="Save hotel" />
          <Button variant="ghost" size="sm" icon="x" accessibilityLabel="Close" />
          <Button variant="secondary" size="lg" icon="map" accessibilityLabel="Open map" />
        </Row>
      ),
    },
    {
      name: "Glass over a photo",
      description: "Floating actions and back buttons over imagery.",
      render: () => (
        <View className="gap-3 rounded-lg bg-brand/16 p-4">
          <Row justify="between">
            <Button variant="glass" icon="arrow-left" accessibilityLabel="Back" />
            <Button variant="glass" icon="heart" accessibilityLabel="Save hotel" />
          </Row>
          <Button variant="glass" size="sm" icon="images">
            32 photos
          </Button>
        </View>
      ),
    },
    {
      name: "Loading",
      description: "The label stays in place (invisible) so the button keeps its size.",
      render: () => (
        <Row gap={2} wrap>
          <Button loading>Request a demo</Button>
          <Button variant="secondary" loading>
            Explore palaces
          </Button>
          <Button variant="highlight" loading>
            Approve version 3
          </Button>
          <Button variant="destructive" loading>
            Remove hotel
          </Button>
        </Row>
      ),
    },
    {
      name: "Disabled",
      description: "Every variant: transparent, dashed pearl 26%, pearl 45% label.",
      render: () => (
        <Row gap={2} wrap>
          <Button disabled>Request a demo</Button>
          <Button variant="secondary" size="sm" disabled>
            Unavailable
          </Button>
          <Button variant="highlight" icon="check" disabled>
            Approve version 3
          </Button>
          <Button variant="glass" icon="heart" accessibilityLabel="Save hotel" disabled />
        </Row>
      ),
    },
    {
      name: "Full width",
      render: () => (
        <Stack gap={2}>
          <Button fullWidth size="lg">
            Confirm booking
          </Button>
          <Text variant="caption" align="center">
            Sticky footers and sheets use the full width.
          </Text>
        </Stack>
      ),
    },
  ],
});
