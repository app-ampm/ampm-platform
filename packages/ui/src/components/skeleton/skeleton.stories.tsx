import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Row, Stack } from "../layout";
import { Skeleton } from "./skeleton";

export const stories = defineStories({
  title: "Skeleton",
  stories: [
    {
      name: "List row",
      description: "Pearl 6% with a pearl 10% shimmer; still under reduced motion.",
      render: () => (
        <Row gap={3}>
          <Skeleton shape="circle" className="h-12 w-12" />
          <Stack gap={2} className="flex-1">
            <Skeleton shape="text" className="w-40" />
            <Skeleton shape="text" className="w-24" />
          </Stack>
        </Row>
      ),
    },
    {
      name: "Text lines",
      render: () => (
        <Stack gap={2}>
          <Skeleton shape="text" className="w-full" />
          <Skeleton shape="text" className="w-full" />
          <Skeleton shape="text" className="w-48" />
        </Stack>
      ),
    },
    { name: "Card", render: () => <Skeleton className="h-32 w-full" /> },
    {
      name: "Inside a panel",
      render: () => (
        <GlassPanel className="gap-3 p-5">
          <Skeleton shape="text" className="w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </GlassPanel>
      ),
    },
  ],
});
