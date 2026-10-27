import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Skeleton } from "./skeleton";

export const stories = defineStories({
  title: "Skeleton",
  stories: [
    {
      name: "List row",
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
    { name: "Card", render: () => <Skeleton className="h-32 w-full" /> },
  ],
});
