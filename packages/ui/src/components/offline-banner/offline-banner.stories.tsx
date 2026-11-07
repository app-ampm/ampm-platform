import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Stack } from "../layout";
import { Text } from "../text";
import { OfflineBanner } from "./offline-banner";

const noop = () => undefined;

export const stories = defineStories({
  title: "OfflineBanner",
  stories: [
    {
      name: "Updates queued",
      description:
        "Peacock glass, offline-safe: the screen keeps working and the queue syncs later.",
      render: () => <OfflineBanner queuedCount={3} />,
    },
    { name: "One update queued", render: () => <OfflineBanner queuedCount={1} /> },
    { name: "Nothing queued yet", render: () => <OfflineBanner /> },
    {
      name: "With retry",
      render: () => <OfflineBanner queuedCount={3} onRetry={noop} retryLabel="Sync now" />,
    },
    {
      name: "Full width on a screen",
      render: () => (
        <Stack gap={3}>
          <OfflineBanner queuedCount={3} onRetry={noop} className="self-stretch" />
          <Text variant="title">Live console</Text>
        </Stack>
      ),
    },
    {
      name: "Inside a panel",
      description: "Inside another glass panel the banner passes blur={false}.",
      render: () => (
        <GlassPanel className="gap-3 p-5">
          <Text variant="heading">Sangeet · cue sheet</Text>
          <OfflineBanner queuedCount={2} blur={false} description="Nothing is lost." />
        </GlassPanel>
      ),
    },
  ],
});
