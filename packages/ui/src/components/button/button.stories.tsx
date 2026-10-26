import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Button } from "./button";

export const stories = defineStories({
  title: "Button",
  stories: [
    {
      name: "Variants",
      render: () => (
        <Row gap={2} wrap>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
        </Row>
      ),
    },
    {
      name: "Sizes",
      render: () => (
        <Row gap={2} wrap align="center">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
      ),
    },
    {
      name: "With icons",
      render: () => (
        <Row gap={2} wrap>
          <Button icon="plus">New request</Button>
          <Button variant="secondary" iconEnd="chevron-right">
            Continue
          </Button>
          <Button variant="ghost" icon="x" accessibilityLabel="Close" />
        </Row>
      ),
    },
    {
      name: "States",
      render: () => (
        <Row gap={2} wrap>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" loading>
            Loading
          </Button>
        </Row>
      ),
    },
    {
      name: "Full width",
      render: () => (
        <Stack>
          <Button fullWidth>Confirm booking</Button>
        </Stack>
      ),
    },
  ],
});
