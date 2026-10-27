import { defineStories } from "../../stories/define";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { OfflineState } from "../offline-state";

export const stories = defineStories({
  title: "States",
  stories: [
    {
      name: "Empty",
      render: () => (
        <EmptyState
          title="No requests yet"
          description="When the client asks for a decision, a change or help with a hotel, it appears here."
          action={{ label: "New request", onPress: () => undefined }}
        />
      ),
    },
    { name: "Error", render: () => <ErrorState onRetry={() => undefined} /> },
    { name: "Offline", render: () => <OfflineState onRetry={() => undefined} /> },
  ],
});
