import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { ProgressBar } from "./progress-bar";

export const stories = defineStories({
  title: "Progress bar",
  stories: [
    {
      name: "Readiness: large, peacock",
      render: () => (
        <Stack gap={2}>
          <Row justify="between">
            <Text variant="label">Readiness · Sangeet</Text>
            <Text variant="data">8 / 10</Text>
          </Row>
          <ProgressBar value={0.8} size="lg" label="Readiness, Sangeet" />
        </Stack>
      ),
    },
    {
      name: "Sizes: sm 4, md 6, lg 8",
      render: () => (
        <Stack gap={3}>
          <ProgressBar value={0.35} size="sm" label="Small" />
          <ProgressBar value={0.6} size="md" label="Medium" />
          <ProgressBar value={0.85} size="lg" label="Large" />
        </Stack>
      ),
    },
    {
      name: "Gold: a countdown",
      render: () => (
        <Stack gap={2}>
          <Row justify="between">
            <Text variant="label">Hotel discovery</Text>
            <Text variant="data" tone="brand">
              12 days left
            </Text>
          </Row>
          <ProgressBar value={12 / 30} tone="brand" label="Days left" valueText="12 days left" />
        </Stack>
      ),
    },
    {
      name: "Segmented: the RSVP wizard",
      render: () => (
        <Stack gap={2}>
          <ProgressBar value={3 / 7} steps={7} size="sm" label="RSVP" />
          <Text variant="caption">STEP 3 OF 7 · KAPOOR HOUSEHOLD</Text>
        </Stack>
      ),
    },
    {
      name: "Empty and complete",
      render: () => (
        <Stack gap={3}>
          <ProgressBar value={0} label="Not started" />
          <ProgressBar value={1} label="Complete" />
          <ProgressBar value={1} steps={4} label="All steps done" />
        </Stack>
      ),
    },
  ],
});
