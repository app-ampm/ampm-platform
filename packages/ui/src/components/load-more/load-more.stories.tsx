import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Text } from "../text";
import { LoadMore } from "./load-more";

/** The footer fetches the next page; once the list is exhausted it renders nothing. */
function Interactive() {
  const [hasMore, setHasMore] = useState(true);
  return (
    <Stack gap={2}>
      <LoadMore hasMore={hasMore} loading={false} onLoadMore={() => setHasMore(false)} />
      {hasMore ? null : (
        <Text variant="bodySmall" tone="muted">
          All items loaded.
        </Text>
      )}
    </Stack>
  );
}

export const stories = defineStories({
  title: "Load more",
  stories: [
    { name: "Interactive", render: () => <Interactive /> },
    { name: "Loading", render: () => <LoadMore hasMore loading onLoadMore={() => {}} /> },
  ],
});
