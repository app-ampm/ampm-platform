import { defineStories } from "../../stories/define";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { GlassPanel } from "../glass-panel";
import { Stack } from "../layout";
import { OfflineState } from "../offline-state";
import { Text } from "../text";
import { StateView } from "./state-view";

const noop = () => undefined;

export const stories = defineStories({
  title: "States",
  stories: [
    {
      name: "Empty",
      description: "Say what creates the first row; offer that action if the person may take it.",
      render: () => (
        <EmptyState
          title="No requests yet"
          description="When the client asks for a decision, a change or help with a hotel, it appears here."
          action={{ label: "New request", onPress: noop }}
        />
      ),
    },
    {
      name: "Empty, the screen's gold action",
      render: () => (
        <EmptyState
          icon="hotel"
          title="No hotels saved"
          description="Save hotels from search to compare them side by side."
          action={{ label: "Search hotels", onPress: noop, variant: "primary" }}
        />
      ),
    },
    {
      name: "Empty, nothing to do",
      render: () => <EmptyState title="Lead not found" description="It may have been removed." />,
    },
    { name: "Error", render: () => <ErrorState onRetry={noop} /> },
    { name: "Error, retrying", render: () => <ErrorState onRetry={noop} retrying /> },
    { name: "Error, no retry", render: () => <ErrorState title="Upload failed" /> },
    { name: "Offline", render: () => <OfflineState /> },
    { name: "Offline, with retry", render: () => <OfflineState onRetry={noop} /> },
    {
      name: "Any state",
      render: () => (
        <StateView
          icon="calendar-days"
          iconTone="highlight"
          title="No functions this week"
          description="The programme shows functions as the team adds them."
        />
      ),
    },
    {
      name: "Nested in a panel",
      description:
        "Inside another glass panel a state passes blur={false}: only top-level panels blur.",
      render: () => (
        <GlassPanel className="p-5">
          <Stack gap={3}>
            <Text variant="heading">Vendors</Text>
            <EmptyState blur={false} title="No vendors shortlisted" />
          </Stack>
        </GlassPanel>
      ),
    },
  ],
});
